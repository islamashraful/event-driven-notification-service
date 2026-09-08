import { describe, expect, it } from "bun:test";
import { classifyFailure } from "../../src/domain/failure-classification";
import {
  NotFoundError,
  PermanentProviderError,
  TransientProviderError,
  ValidationError,
} from "../../src/shared/errors";

describe("classifyFailure", () => {
  it("classifies a PermanentProviderError as a non-retryable invalid-token", () => {
    const result = classifyFailure(new PermanentProviderError("DeviceNotRegistered"));
    expect(result).toEqual({ retryable: false, reason: "invalid-token" });
  });

  it("classifies a TransientProviderError as retryable", () => {
    const result = classifyFailure(new TransientProviderError("Expo temporarily unavailable"));
    expect(result).toEqual({ retryable: true, reason: "transient" });
  });

  it("classifies a ValidationError as a non-retryable invalid-payload", () => {
    const result = classifyFailure(new ValidationError("missing field"));
    expect(result).toEqual({ retryable: false, reason: "invalid-payload" });
  });

  it("classifies a NotFoundError as non-retryable", () => {
    const result = classifyFailure(new NotFoundError("no push token for user"));
    expect(result).toEqual({ retryable: false, reason: "not-found" });
  });

  it("defaults an unrecognized error to retryable, so it isn't silently dropped", () => {
    const result = classifyFailure(new Error("something unexpected"));
    expect(result).toEqual({ retryable: true, reason: "unknown" });
  });

  it("defaults a non-Error thrown value to retryable too", () => {
    const result = classifyFailure("a string was thrown");
    expect(result).toEqual({ retryable: true, reason: "unknown" });
  });
});
