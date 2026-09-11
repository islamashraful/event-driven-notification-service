import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from "aws-lambda";
import { classifyFailure } from "../../domain/failure-classification";
import { parseNotificationEvent, type NotificationEvent } from "../../domain/events";
import { buildNotificationContent } from "../../domain/notification-builder";
import type { PushProvider, PushTokenRepository } from "../../domain/ports";
import { DynamoDbPushTokenRepository } from "../../infrastructure/dynamodb/dynamodb-push-token-repository";
import { ExpoPushProvider } from "../../infrastructure/expo/expo-push-provider";
import { requiredEnv } from "../../shared/env";
import { NotFoundError } from "../../shared/errors";
import { log } from "../../shared/logger";

type Dependencies = {
  tokenRepository: PushTokenRepository;
  pushProvider: PushProvider;
};

/**
 * Processes one SQS record: parse, look up the user's token, build the
 * notification, send it. On failure, classifies what happened
 * (see classifyFailure) - a dead token gets deactivated, everything gets
 * logged, and only a *retryable* failure is rethrown. A non-retryable
 * failure means the worker already did the right thing with it (dropped
 * an invalid message, deactivated a dead token) - there's nothing left
 * for a retry to accomplish, so the caller shouldn't ask SQS for one.
 */
export async function processRecord(deps: Dependencies, body: string): Promise<void> {
  const startedAt = Date.now();
  let event: NotificationEvent | undefined;

  try {
    event = parseNotificationEvent(JSON.parse(body));

    const token = await deps.tokenRepository.getToken(event.userId);
    if (!token || !token.active) {
      throw new NotFoundError(`No active push token for user ${event.userId}`);
    }

    const content = buildNotificationContent(event);
    await deps.pushProvider.send(token.pushToken, content);

    log({
      eventId: event.eventId,
      eventType: event.eventType,
      userId: event.userId,
      status: "success",
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const classification = classifyFailure(error);

    if (classification.reason === "invalid-token" && event) {
      await deps.tokenRepository.deactivateToken(event.userId);
    }

    log({
      eventId: event?.eventId ?? "unknown",
      eventType: event?.eventType ?? "unknown",
      userId: event?.userId ?? "unknown",
      status: "failure",
      durationMs: Date.now() - startedAt,
      errorType: classification.reason,
    });

    if (classification.retryable) {
      throw error;
    }
  }
}

// Built lazily, on first invocation, so importing this module (e.g. from a
// test) doesn't require TABLE_NAME to be set - only actually handling a
// request does.
let tokenRepository: PushTokenRepository | undefined;
let pushProvider: PushProvider | undefined;

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  tokenRepository ??= new DynamoDbPushTokenRepository(
    requiredEnv("TABLE_NAME"),
    DynamoDBDocumentClient.from(new DynamoDBClient({})),
  );
  pushProvider ??= new ExpoPushProvider();

  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      await processRecord({ tokenRepository, pushProvider }, record.body);
    } catch {
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}
