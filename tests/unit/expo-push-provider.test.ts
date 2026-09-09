import { describe, expect, it } from "bun:test";
import type { NotificationContent } from "../../src/domain/notification";
import { ExpoPushProvider } from "../../src/infrastructure/expo/expo-push-provider";
import { PermanentProviderError, TransientProviderError } from "../../src/shared/errors";

const validToken = "ExponentPushToken[abc123]";
const content: NotificationContent = {
  title: "Campaign approved",
  body: "Your campaign has been approved.",
  data: { campaignId: "a1b2c3d4-e5f6-4789-a012-3456789abcde" },
};

describe("ExpoPushProvider", () => {
  it("resolves when Expo returns a success ticket", async () => {
    const provider = new ExpoPushProvider({
      sendPushNotificationsAsync: async () => [{ status: "ok", id: "receipt-1" }],
    });

    await expect(provider.send(validToken, content)).resolves.toBeUndefined();
  });

  it("rejects with PermanentProviderError for a malformed token, without calling Expo", async () => {
    let called = false;
    const provider = new ExpoPushProvider({
      sendPushNotificationsAsync: async () => {
        called = true;
        return [{ status: "ok", id: "receipt-1" }];
      },
    });

    await expect(provider.send("not-a-real-token", content)).rejects.toBeInstanceOf(
      PermanentProviderError,
    );
    expect(called).toBe(false);
  });

  it("rejects with PermanentProviderError when Expo reports DeviceNotRegistered", async () => {
    const provider = new ExpoPushProvider({
      sendPushNotificationsAsync: async () => [
        { status: "error", message: "device not registered", details: { error: "DeviceNotRegistered" } },
      ],
    });

    await expect(provider.send(validToken, content)).rejects.toBeInstanceOf(
      PermanentProviderError,
    );
  });

  it("rejects with TransientProviderError for other Expo error tickets", async () => {
    const provider = new ExpoPushProvider({
      sendPushNotificationsAsync: async () => [
        { status: "error", message: "rate exceeded", details: { error: "MessageRateExceeded" } },
      ],
    });

    await expect(provider.send(validToken, content)).rejects.toBeInstanceOf(
      TransientProviderError,
    );
  });

  it("rejects with TransientProviderError when the Expo call itself fails", async () => {
    const provider = new ExpoPushProvider({
      sendPushNotificationsAsync: async () => {
        throw new Error("network error");
      },
    });

    await expect(provider.send(validToken, content)).rejects.toBeInstanceOf(
      TransientProviderError,
    );
  });
});
