import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoDbPushTokenRepository } from "../../infrastructure/dynamodb/dynamodb-push-token-repository";
import type { PushTokenRepository } from "../../domain/ports";
import { requiredEnv } from "../../shared/env";

const STALE_AFTER_DAYS = 90;

export type CleanupResult = { deleted: number; failed: number };

/**
 * Deletes (not just deactivates) any token that hasn't been active in
 * STALE_AFTER_DAYS - this is the one place actually meant to clean the
 * table up, unlike registerToken's DELETE which only deactivates.
 *
 * findStale does a full table Scan (see ADR 0007) - fine for an
 * occasional low-frequency sweep at this service's demo scale, but it
 * wouldn't scale to a table with millions of rows; a GSI on
 * lastActiveAt would be the fix if this table ever got that big.
 *
 * Each delete is isolated - one failing delete (e.g. a transient
 * DynamoDB error) shouldn't stop the rest of the sweep, since the
 * tokens are unrelated to each other. A token whose delete fails stays
 * stale and gets picked up again by tomorrow's run, since findStale
 * re-scans the whole table every time rather than tracking progress.
 */
export async function cleanup(repository: PushTokenRepository, now: Date): Promise<CleanupResult> {
  const cutoff = new Date(now.getTime() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const staleTokens = await repository.findStale(cutoff);

  let deleted = 0;
  let failed = 0;

  for (const token of staleTokens) {
    try {
      await repository.deleteToken(token.userId);
      deleted++;
    } catch (error) {
      failed++;
      console.error(`Failed to delete stale token for user ${token.userId}`, error);
    }
  }

  return { deleted, failed };
}

// Built lazily, on first invocation, so importing this module (e.g. from a
// test) doesn't require TABLE_NAME to be set - only actually handling a
// request does.
let repository: PushTokenRepository | undefined;

export async function handler(): Promise<void> {
  repository ??= new DynamoDbPushTokenRepository(
    requiredEnv("TABLE_NAME"),
    DynamoDBDocumentClient.from(new DynamoDBClient({})),
  );
  const result = await cleanup(repository, new Date());
  // Not a NotificationEvent outcome, so this doesn't go through
  // src/shared/logger.ts's fixed schema - just a plain structured line,
  // still picked up by CloudWatch automatically.
  console.log(JSON.stringify({ task: "cleanup", ...result }));
}
