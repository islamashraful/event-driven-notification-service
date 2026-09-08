import type { NotificationContent } from "./notification";

/**
 * The contracts the domain depends on, without knowing (or caring) how
 * they're actually fulfilled. `infrastructure/` implements these against
 * real AWS/Expo services; tests implement them against fakes. Nothing in
 * `domain/` imports an AWS SDK or the Expo client directly — it only ever
 * sees these interfaces.
 */

export interface PushProvider {
  /**
   * Sends a push notification. Resolves on success.
   *
   * Throws `PermanentProviderError` when the token itself is dead (e.g.
   * Expo's DeviceNotRegistered) or `TransientProviderError` for anything
   * else likely to succeed on retry. Callers run the error through
   * `classifyFailure` rather than branching on a result value here — one
   * place decides what a failure means, not two.
   */
  send(pushToken: string, content: NotificationContent): Promise<void>;
}

export type PushTokenPlatform = "ios" | "android";

export type PushToken = {
  userId: string;
  pushToken: string;
  platform: PushTokenPlatform;
  active: boolean;
  lastActiveAt: string;
};

export interface PushTokenRepository {
  getToken(userId: string): Promise<PushToken | null>;
  saveToken(userId: string, pushToken: string, platform: PushTokenPlatform): Promise<void>;
  deactivateToken(userId: string): Promise<void>;
  deleteToken(userId: string): Promise<void>;
  findStale(olderThan: Date): Promise<PushToken[]>;
}
