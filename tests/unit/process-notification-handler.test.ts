import { describe, expect, it } from "bun:test";
import type { PushToken, PushTokenPlatform, PushProvider, PushTokenRepository } from "../../src/domain/ports";
import { processRecord } from "../../src/functions/process-notification/handler";
import { PermanentProviderError, TransientProviderError } from "../../src/shared/errors";
import type { NotificationContent } from "../../src/domain/notification";

const validUserId = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

const validBody = JSON.stringify({
  userId: validUserId,
  eventType: "NEW_MESSAGE",
  data: { senderName: "Alex" },
  eventId: "evt_123",
  receivedAt: "2026-09-11T00:00:00.000Z",
});

const activeToken: PushToken = {
  userId: validUserId,
  pushToken: "ExponentPushToken[abc123]",
  platform: "ios" as PushTokenPlatform,
  active: true,
  lastActiveAt: "2026-09-11T00:00:00.000Z",
};

function fakeRepository(overrides: Partial<PushTokenRepository> = {}): PushTokenRepository {
  return {
    getToken: async () => activeToken,
    saveToken: async () => {},
    deactivateToken: async () => {},
    deleteToken: async () => {},
    findStale: async () => [],
    ...overrides,
  };
}

function fakeProvider(send: PushProvider["send"]): PushProvider {
  return { send };
}

describe("processRecord", () => {
  it("sends the notification for a valid message with an active token", async () => {
    let sentTo: string | undefined;
    let sentContent: NotificationContent | undefined;
    const provider = fakeProvider(async (pushToken, content) => {
      sentTo = pushToken;
      sentContent = content;
    });

    await processRecord({ tokenRepository: fakeRepository(), pushProvider: provider }, validBody);

    expect(sentTo).toBe(activeToken.pushToken);
    expect(sentContent?.title).toBe("New message from Alex");
  });

  it("does not throw and does not deactivate when the message body is malformed JSON", async () => {
    let deactivated = false;
    const repository = fakeRepository({
      deactivateToken: async () => {
        deactivated = true;
      },
    });
    const provider = fakeProvider(async () => {});

    await expect(
      processRecord({ tokenRepository: repository, pushProvider: provider }, "not json"),
    ).rejects.toBeDefined();
    expect(deactivated).toBe(false);
  });

  it("does not rethrow when the message fails schema validation (not retryable)", async () => {
    const provider = fakeProvider(async () => {});

    await expect(
      processRecord(
        { tokenRepository: fakeRepository(), pushProvider: provider },
        JSON.stringify({ eventType: "NEW_MESSAGE" }),
      ),
    ).resolves.toBeUndefined();
  });

  it("does not rethrow and does not deactivate when there's no active token (not-found)", async () => {
    let deactivated = false;
    let sent = false;
    const repository = fakeRepository({
      getToken: async () => null,
      deactivateToken: async () => {
        deactivated = true;
      },
    });
    const provider = fakeProvider(async () => {
      sent = true;
    });

    await expect(
      processRecord({ tokenRepository: repository, pushProvider: provider }, validBody),
    ).resolves.toBeUndefined();
    expect(sent).toBe(false);
    expect(deactivated).toBe(false);
  });

  it("does not rethrow when the token is inactive", async () => {
    const repository = fakeRepository({
      getToken: async () => ({ ...activeToken, active: false }),
    });
    const provider = fakeProvider(async () => {});

    await expect(
      processRecord({ tokenRepository: repository, pushProvider: provider }, validBody),
    ).resolves.toBeUndefined();
  });

  it("deactivates the token and does not rethrow when the provider reports a dead device", async () => {
    let deactivatedUserId: string | undefined;
    const repository = fakeRepository({
      deactivateToken: async (userId) => {
        deactivatedUserId = userId;
      },
    });
    const provider = fakeProvider(async () => {
      throw new PermanentProviderError("dead device");
    });

    await expect(
      processRecord({ tokenRepository: repository, pushProvider: provider }, validBody),
    ).resolves.toBeUndefined();
    expect(deactivatedUserId).toBe(validUserId);
  });

  it("rethrows without deactivating when the provider fails transiently", async () => {
    let deactivated = false;
    const repository = fakeRepository({
      deactivateToken: async () => {
        deactivated = true;
      },
    });
    const provider = fakeProvider(async () => {
      throw new TransientProviderError("network blip");
    });

    await expect(
      processRecord({ tokenRepository: repository, pushProvider: provider }, validBody),
    ).rejects.toBeInstanceOf(TransientProviderError);
    expect(deactivated).toBe(false);
  });
});
