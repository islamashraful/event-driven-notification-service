import { describe, expect, it } from "bun:test";
import type { PushToken, PushTokenPlatform, PushTokenRepository } from "../../src/domain/ports";
import { registerToken } from "../../src/functions/register-token/handler";

const validUserId = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

function fakeRepository(overrides: Partial<PushTokenRepository> = {}): PushTokenRepository {
  const saved: { userId: string; pushToken: string; platform: PushTokenPlatform }[] = [];
  const deactivated: string[] = [];
  return {
    getToken: async () => null,
    saveToken: async (userId, pushToken, platform) => {
      saved.push({ userId, pushToken, platform });
    },
    deactivateToken: async (userId) => {
      deactivated.push(userId);
    },
    deleteToken: async () => {},
    findStale: async () => [] as PushToken[],
    ...overrides,
  };
}

describe("registerToken", () => {
  it("returns 400 for a non-UUID userId, without touching the repository", async () => {
    let called = false;
    const repository = fakeRepository({
      saveToken: async () => {
        called = true;
      },
    });

    const result = await registerToken(repository, "PUT", "not-a-uuid", "{}");

    expect(result.statusCode).toBe(400);
    expect(called).toBe(false);
  });

  it("returns 400 when userId is missing", async () => {
    const result = await registerToken(fakeRepository(), "PUT", undefined, "{}");
    expect(result.statusCode).toBe(400);
  });

  it("PUT saves the token and returns 200", async () => {
    const saved: { userId: string; pushToken: string; platform: PushTokenPlatform }[] = [];
    const repository = fakeRepository({
      saveToken: async (userId, pushToken, platform) => {
        saved.push({ userId, pushToken, platform });
      },
    });

    const result = await registerToken(
      repository,
      "PUT",
      validUserId,
      JSON.stringify({ pushToken: "ExponentPushToken[abc123]", platform: "ios" }),
    );

    expect(result.statusCode).toBe(200);
    expect(saved).toEqual([
      { userId: validUserId, pushToken: "ExponentPushToken[abc123]", platform: "ios" },
    ]);
  });

  it("PUT returns 400 without saving when the body fails validation", async () => {
    let called = false;
    const repository = fakeRepository({
      saveToken: async () => {
        called = true;
      },
    });

    const result = await registerToken(
      repository,
      "PUT",
      validUserId,
      JSON.stringify({ platform: "windows-phone" }),
    );

    expect(result.statusCode).toBe(400);
    expect(called).toBe(false);
  });

  it("PUT returns 400 without saving when the body isn't valid JSON", async () => {
    let called = false;
    const repository = fakeRepository({
      saveToken: async () => {
        called = true;
      },
    });

    const result = await registerToken(repository, "PUT", validUserId, "not json");

    expect(result.statusCode).toBe(400);
    expect(called).toBe(false);
  });

  it("DELETE deactivates the token and returns 200", async () => {
    const deactivated: string[] = [];
    const repository = fakeRepository({
      deactivateToken: async (userId) => {
        deactivated.push(userId);
      },
    });

    const result = await registerToken(repository, "DELETE", validUserId, null);

    expect(result.statusCode).toBe(200);
    expect(deactivated).toEqual([validUserId]);
  });
});
