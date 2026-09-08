import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { log } from "../../src/shared/logger";

describe("log", () => {
  let originalConsoleLog: typeof console.log;
  let output: string[];

  beforeEach(() => {
    originalConsoleLog = console.log;
    output = [];
    console.log = mock((line: string) => {
      output.push(line);
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it("writes a single structured JSON line", () => {
    log({
      eventId: "evt_1",
      eventType: "CAMPAIGN_APPROVED",
      userId: "user_123",
      status: "success",
      durationMs: 42,
    });

    expect(output.length).toBe(1);
    const parsed = JSON.parse(output[0] as string);
    expect(parsed).toEqual({
      eventId: "evt_1",
      eventType: "CAMPAIGN_APPROVED",
      userId: "user_123",
      status: "success",
      durationMs: 42,
    });
  });

  it("includes errorType only when provided", () => {
    log({
      eventId: "evt_2",
      eventType: "CAMPAIGN_APPROVED",
      userId: "user_123",
      status: "failure",
      durationMs: 10,
      errorType: "TransientProviderError",
    });

    const parsed = JSON.parse(output[0] as string);
    expect(parsed.errorType).toBe("TransientProviderError");
  });

  it("never logs a field outside the allowlist, even if smuggled in", () => {
    // Simulates a caller bypassing the type system (e.g. via `as any`)
    // to try to sneak an extra field like a push token into the entry.
    const entryWithExtraField = {
      eventId: "evt_3",
      eventType: "CAMPAIGN_APPROVED",
      userId: "user_123",
      status: "success",
      durationMs: 5,
      pushToken: "ExponentPushToken[super-secret]",
    };

    log(entryWithExtraField as unknown as Parameters<typeof log>[0]);

    const parsed = JSON.parse(output[0] as string);
    expect(parsed.pushToken).toBeUndefined();
    expect(output[0]).not.toContain("super-secret");
  });
});
