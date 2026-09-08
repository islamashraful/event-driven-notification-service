import {
  NotFoundError,
  PermanentProviderError,
  TransientProviderError,
  ValidationError,
} from "../shared/errors";

/**
 * What to do about a processing failure. `retryable: true` means "let SQS
 * redeliver this message" (via visibility timeout, eventually the DLQ if
 * it keeps failing). `retryable: false` means the worker already did the
 * right thing with it (e.g. deactivated a dead token, or logged and
 * dropped a validation problem) — retrying it wouldn't help.
 */
export type FailureClassification =
  | { retryable: true; reason: "transient" }
  | { retryable: false; reason: "invalid-token" }
  | { retryable: false; reason: "invalid-payload" }
  | { retryable: false; reason: "not-found" }
  | { retryable: true; reason: "unknown" };

/**
 * Classifies an error thrown during processing into a retry decision.
 *
 * Unrecognized errors default to retryable — better to let SQS keep
 * retrying (and eventually land the message in the DLQ for a human to
 * look at) than to silently swallow something we don't understand.
 */
export function classifyFailure(error: unknown): FailureClassification {
  if (error instanceof PermanentProviderError) {
    return { retryable: false, reason: "invalid-token" };
  }
  if (error instanceof TransientProviderError) {
    return { retryable: true, reason: "transient" };
  }
  if (error instanceof ValidationError) {
    return { retryable: false, reason: "invalid-payload" };
  }
  if (error instanceof NotFoundError) {
    return { retryable: false, reason: "not-found" };
  }
  return { retryable: true, reason: "unknown" };
}
