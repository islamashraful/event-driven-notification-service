import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { z } from "zod";
import { DynamoDbPushTokenRepository } from "../../infrastructure/dynamodb/dynamodb-push-token-repository";
import type { PushTokenRepository } from "../../domain/ports";
import { requiredEnv } from "../../shared/env";

const registerTokenRequestSchema = z.object({
  pushToken: z.string().min(1),
  platform: z.enum(["ios", "android"]),
});

/**
 * PUT saves/replaces the caller's push token. DELETE deactivates it
 * (`deactivateToken`, not `deleteToken`) - the row stays for history/
 * auditing, just marked inactive, matching how a dead token is already
 * handled elsewhere (see ADR 0008). A hard delete is a separate,
 * more destructive operation this endpoint doesn't expose.
 */
export async function registerToken(
  repository: PushTokenRepository,
  method: string,
  userId: string | undefined,
  rawBody: string | null,
): Promise<APIGatewayProxyResult> {
  if (!userId || !z.string().uuid().safeParse(userId).success) {
    return { statusCode: 400, body: JSON.stringify({ error: "userId must be a valid UUID" }) };
  }

  if (method === "DELETE") {
    await repository.deactivateToken(userId);
    // Not a NotificationEvent outcome, so this doesn't go through
    // src/shared/logger.ts's fixed schema - just a plain structured line,
    // still picked up by CloudWatch automatically.
    console.log(JSON.stringify({ task: "registerToken", action: "deactivate", userId }));
    return { statusCode: 200, body: JSON.stringify({ userId, active: false }) };
  }

  let body: unknown;
  try {
    body = rawBody === null ? undefined : JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Request body must be valid JSON" }) };
  }

  const parsed = registerTokenRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { statusCode: 400, body: JSON.stringify({ error: parsed.error.message }) };
  }

  await repository.saveToken(userId, parsed.data.pushToken, parsed.data.platform);
  console.log(JSON.stringify({ task: "registerToken", action: "save", userId }));
  return { statusCode: 200, body: JSON.stringify({ userId, active: true }) };
}

// Built lazily, on first invocation, so importing this module (e.g. from a
// test) doesn't require TABLE_NAME to be set - only actually handling a
// request does.
let repository: PushTokenRepository | undefined;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  repository ??= new DynamoDbPushTokenRepository(
    requiredEnv("TABLE_NAME"),
    DynamoDBDocumentClient.from(new DynamoDBClient({})),
  );
  return registerToken(repository, event.httpMethod, event.pathParameters?.id, event.body);
}
