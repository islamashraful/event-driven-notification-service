import { describe, expect, it } from "bun:test";
import type { PushToken, PushTokenRepository } from "../../src/domain/ports";
import { cleanup } from "../../src/functions/cleanup/handler";

function fakeRepository(
  staleTokens: PushToken[],
  overrides: Partial<PushTokenRepository> = {},
): PushTokenRepository {
  return {
    getToken: async () => null,
    saveToken: async () => {},
    deactivateToken: async () => {},
    deleteToken: async () => {},
    findStale: async () => staleTokens,
    ...overrides,
  };
}

const staleToken: PushToken = {
  userId: "a1b2c3d4-e5f6-4789-a012-3456789abcde",
  pushToken: "ExponentPushToken[abc123]",
  platform: "ios",
  active: true,
  lastActiveAt: "2020-01-01T00:00:00.000Z",
};

describe("cleanup", () => {
  it("deletes every token findStale returns and reports the count", async () => {
    const deleted: string[] = [];
    const repository = fakeRepository([staleToken], {
      deleteToken: async (userId) => {
        deleted.push(userId);
      },
    });

    const result = await cleanup(repository, new Date("2026-09-11T00:00:00.000Z"));

    expect(result).toEqual({ deleted: 1, failed: 0 });
    expect(deleted).toEqual([staleToken.userId]);
  });

  it("deletes nothing when no tokens are stale", async () => {
    let called = false;
    const repository = fakeRepository([], {
      deleteToken: async () => {
        called = true;
      },
    });

    const result = await cleanup(repository, new Date("2026-09-11T00:00:00.000Z"));

    expect(result).toEqual({ deleted: 0, failed: 0 });
    expect(called).toBe(false);
  });

  it("isolates a failing delete so the rest of the sweep still runs", async () => {
    const secondStaleToken: PushToken = { ...staleToken, userId: "b2c3d4e5-f6a7-4890-b123-4567890abcde" };
    const deleted: string[] = [];
    const repository = fakeRepository([staleToken, secondStaleToken], {
      deleteToken: async (userId) => {
        if (userId === staleToken.userId) {
          throw new Error("transient DynamoDB error");
        }
        deleted.push(userId);
      },
    });

    const result = await cleanup(repository, new Date("2026-09-11T00:00:00.000Z"));

    expect(result).toEqual({ deleted: 1, failed: 1 });
    expect(deleted).toEqual([secondStaleToken.userId]);
  });

  it("passes a cutoff roughly 90 days before `now` to findStale", async () => {
    let receivedCutoff: Date | undefined;
    const repository = fakeRepository([], {
      findStale: async (cutoff) => {
        receivedCutoff = cutoff;
        return [];
      },
    });

    const now = new Date("2026-09-11T00:00:00.000Z");
    await cleanup(repository, now);

    const daysBefore = (now.getTime() - (receivedCutoff?.getTime() ?? 0)) / (24 * 60 * 60 * 1000);
    expect(daysBefore).toBe(90);
  });
});
