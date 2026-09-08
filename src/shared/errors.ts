/** The request body didn't match the event contract. */
export class ValidationError extends Error {}

/** Something we expected to exist (e.g. a user's push token) wasn't found. */
export class NotFoundError extends Error {}

/**
 * The push provider failed in a way that's likely to succeed if retried
 * (e.g. Expo briefly unavailable, a network blip).
 */
export class TransientProviderError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}

/**
 * The push provider rejected the request in a way retrying won't fix
 * (e.g. Expo's DeviceNotRegistered — the token itself is dead).
 */
export class PermanentProviderError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}
