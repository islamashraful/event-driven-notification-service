import { describe, expect, it } from "bun:test";
import { normalizeEvent } from "../../src/domain/events";
import { buildNotificationContent } from "../../src/domain/notification-builder";

const userId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const campaignId = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

describe("buildNotificationContent", () => {
  it("builds content for CAMPAIGN_APPROVED", () => {
    const event = normalizeEvent({
      eventType: "CAMPAIGN_APPROVED",
      userId,
      data: { campaignId },
    });

    const content = buildNotificationContent(event);

    expect(content.title).toBe("Campaign approved");
    expect(content.body.length).toBeGreaterThan(0);
    expect(content.data).toEqual({ campaignId, eventType: "CAMPAIGN_APPROVED" });
  });

  it("builds content for CAMPAIGN_REJECTED", () => {
    const event = normalizeEvent({
      eventType: "CAMPAIGN_REJECTED",
      userId,
      data: { campaignId },
    });

    const content = buildNotificationContent(event);

    expect(content.title).toBe("Campaign rejected");
    expect(content.data).toEqual({ campaignId, eventType: "CAMPAIGN_REJECTED" });
  });

  it("builds content for NEW_MESSAGE, including the sender's name", () => {
    const event = normalizeEvent({
      eventType: "NEW_MESSAGE",
      userId,
      data: { senderName: "Alex" },
    });

    const content = buildNotificationContent(event);

    expect(content.title).toBe("New message from Alex");
    expect(content.data).toEqual({ eventType: "NEW_MESSAGE" });
  });

  it("produces different content for different event types", () => {
    const approved = buildNotificationContent(
      normalizeEvent({ eventType: "CAMPAIGN_APPROVED", userId, data: { campaignId } }),
    );
    const rejected = buildNotificationContent(
      normalizeEvent({ eventType: "CAMPAIGN_REJECTED", userId, data: { campaignId } }),
    );

    expect(approved.title).not.toBe(rejected.title);
  });
});
