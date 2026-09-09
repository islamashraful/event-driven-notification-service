import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "bun:test";
import type { PushToken } from "../../src/domain/ports";
import { DynamoDbPushTokenRepository } from "../../src/infrastructure/dynamodb/dynamodb-push-token-repository";

const tableName = "test-push-tokens";
const userId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

function fakeClient(items: Map<string, PushToken>) {
  return {
    send: async (command: unknown) => {
      if (command instanceof GetCommand) {
        return { Item: items.get(command.input.Key?.userId as string) };
      }
      if (command instanceof PutCommand) {
        items.set(command.input.Item?.userId as string, command.input.Item as PushToken);
        return {};
      }
      if (command instanceof UpdateCommand) {
        const key = command.input.Key?.userId as string;
        const existing = items.get(key);
        if (existing) {
          items.set(key, { ...existing, active: false });
        }
        return {};
      }
      if (command instanceof DeleteCommand) {
        items.delete(command.input.Key?.userId as string);
        return {};
      }
      if (command instanceof ScanCommand) {
        const cutoff = command.input.ExpressionAttributeValues?.[":cutoff"] as string;
        return { Items: [...items.values()].filter((item) => item.lastActiveAt < cutoff) };
      }
      throw new Error(`Unhandled command: ${command?.constructor.name}`);
    },
  };
}

describe("DynamoDbPushTokenRepository", () => {
  it("returns null when no token is stored for the user", async () => {
    const repo = new DynamoDbPushTokenRepository(tableName, fakeClient(new Map()));

    expect(await repo.getToken(userId)).toBeNull();
  });

  it("saves and retrieves a token", async () => {
    const repo = new DynamoDbPushTokenRepository(tableName, fakeClient(new Map()));

    await repo.saveToken(userId, "ExponentPushToken[abc]", "ios");
    const token = await repo.getToken(userId);

    expect(token?.userId).toBe(userId);
    expect(token?.pushToken).toBe("ExponentPushToken[abc]");
    expect(token?.platform).toBe("ios");
    expect(token?.active).toBe(true);
  });

  it("deactivates a token without deleting it", async () => {
    const items = new Map<string, PushToken>();
    const repo = new DynamoDbPushTokenRepository(tableName, fakeClient(items));

    await repo.saveToken(userId, "ExponentPushToken[abc]", "ios");
    await repo.deactivateToken(userId);
    const token = await repo.getToken(userId);

    expect(token?.active).toBe(false);
    expect(token?.pushToken).toBe("ExponentPushToken[abc]");
  });

  it("deletes a token", async () => {
    const repo = new DynamoDbPushTokenRepository(tableName, fakeClient(new Map()));

    await repo.saveToken(userId, "ExponentPushToken[abc]", "ios");
    await repo.deleteToken(userId);

    expect(await repo.getToken(userId)).toBeNull();
  });

  it("finds tokens last active before the given cutoff", async () => {
    const items = new Map<string, PushToken>([
      [
        "stale-user",
        {
          userId: "stale-user",
          pushToken: "ExponentPushToken[old]",
          platform: "android",
          active: true,
          lastActiveAt: "2020-01-01T00:00:00.000Z",
        },
      ],
      [
        "fresh-user",
        {
          userId: "fresh-user",
          pushToken: "ExponentPushToken[new]",
          platform: "android",
          active: true,
          lastActiveAt: new Date().toISOString(),
        },
      ],
    ]);
    const repo = new DynamoDbPushTokenRepository(tableName, fakeClient(items));

    const stale = await repo.findStale(new Date("2023-01-01"));

    expect(stale).toHaveLength(1);
    expect(stale[0]?.userId).toBe("stale-user");
  });
});
