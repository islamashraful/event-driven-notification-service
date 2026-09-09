import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import type { NotificationContent } from "../../domain/notification";
import type { PushProvider } from "../../domain/ports";
import { PermanentProviderError, TransientProviderError } from "../../shared/errors";

export class ExpoPushProvider implements PushProvider {
  constructor(
    private readonly client: Pick<Expo, "sendPushNotificationsAsync"> = new Expo(),
  ) {}

  async send(pushToken: string, content: NotificationContent): Promise<void> {
    if (!Expo.isExpoPushToken(pushToken)) {
      throw new PermanentProviderError(`Not a valid Expo push token: ${pushToken}`);
    }

    const message: ExpoPushMessage = {
      to: pushToken,
      title: content.title,
      body: content.body,
      data: content.data,
    };

    const tickets = await this.client.sendPushNotificationsAsync([message]).catch((error) => {
      throw new TransientProviderError("Failed to reach the Expo push service", error);
    });

    const ticket = tickets[0];
    if (ticket?.status === "error") {
      if (ticket.details?.error === "DeviceNotRegistered") {
        throw new PermanentProviderError(ticket.message, ticket.details);
      }
      throw new TransientProviderError(ticket.message, ticket.details);
    }
  }
}
