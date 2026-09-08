import type { NotificationEvent } from "./events";
import type { NotificationContent } from "./notification";

/**
 * Turns "this event happened" into "here's what the user reads." This is
 * deliberately the only place presentation text lives — producers only
 * describe events; this service alone decides how they're presented.
 */
export function buildNotificationContent(event: NotificationEvent): NotificationContent {
  switch (event.eventType) {
    case "CAMPAIGN_APPROVED":
      return {
        title: "Campaign approved",
        body: "Your campaign has been approved.",
        data: { campaignId: event.data.campaignId, eventType: event.eventType },
      };
    case "CAMPAIGN_REJECTED":
      return {
        title: "Campaign rejected",
        body: "Your campaign was not approved this time.",
        data: { campaignId: event.data.campaignId, eventType: event.eventType },
      };
    case "NEW_MESSAGE":
      return {
        title: `New message from ${event.data.senderName}`,
        body: "You have a new message.",
        data: { eventType: event.eventType },
      };
  }
}
