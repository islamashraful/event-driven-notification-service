import { describe, expect, it } from "bun:test";
import { normalizeEvent, parseIncomingEvent } from "../../src/domain/events";

const userId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const campaignId = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

describe("parseIncomingEvent", () => {
  it("accepts a well-formed CAMPAIGN_APPROVED request", () => {
    const result = parseIncomingEvent({
      eventType: "CAMPAIGN_APPROVED",
      userId,
      data: { campaignId },
    });

    expect(result.success).toBe(true);
  });

  it("accepts a well-formed NEW_MESSAGE request", () => {
    const result = parseIncomingEvent({
      eventType: "NEW_MESSAGE",
      userId,
      data: { senderName: "Alex" },
    });

    expect(result.success).toBe(true);
  });

  it("rejects an unknown eventType", () => {
    const result = parseIncomingEvent({
      eventType: "SOMETHING_ELSE",
      userId,
      data: {},
    });

    expect(result.success).toBe(false);
  });

  it("rejects a payload missing userId", () => {
    const result = parseIncomingEvent({
      eventType: "CAMPAIGN_APPROVED",
      data: { campaignId },
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID userId", () => {
    const result = parseIncomingEvent({
      eventType: "CAMPAIGN_APPROVED",
      userId: "user_123",
      data: { campaignId },
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID campaignId", () => {
    const result = parseIncomingEvent({
      eventType: "CAMPAIGN_APPROVED",
      userId,
      data: { campaignId: "campaign_456" },
    });

    expect(result.success).toBe(false);
  });

  it("rejects a CAMPAIGN_APPROVED request with mismatched data", () => {
    const result = parseIncomingEvent({
      eventType: "CAMPAIGN_APPROVED",
      userId,
      data: { senderName: "Alex" },
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-object input", () => {
    const result = parseIncomingEvent("not an event");
    expect(result.success).toBe(false);
  });

  it("strips an eventId if a producer sends one", () => {
    // Producers must not be able to assign their own eventId — this
    // service alone owns identity/provenance.
    const result = parseIncomingEvent({
      eventId: "evt_should_be_ignored",
      eventType: "CAMPAIGN_APPROVED",
      userId,
      data: { campaignId },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect("eventId" in result.request).toBe(false);
    }
  });
});

describe("normalizeEvent", () => {
  it("assigns an eventId and receivedAt timestamp", () => {
    const event = normalizeEvent({
      eventType: "CAMPAIGN_APPROVED",
      userId,
      data: { campaignId },
    });

    expect(event.eventId).toStartWith("evt_");
    expect(new Date(event.receivedAt).toISOString()).toBe(event.receivedAt);
  });

  it("generates a distinct eventId per call", () => {
    const request = {
      eventType: "NEW_MESSAGE" as const,
      userId,
      data: { senderName: "Alex" },
    };

    const first = normalizeEvent(request);
    const second = normalizeEvent(request);

    expect(first.eventId).not.toBe(second.eventId);
  });

  it("preserves the original request fields", () => {
    const event = normalizeEvent({
      eventType: "CAMPAIGN_REJECTED",
      userId,
      data: { campaignId },
    });

    expect(event.eventType).toBe("CAMPAIGN_REJECTED");
    expect(event.userId).toBe(userId);
    expect(event.data).toEqual({ campaignId });
  });
});
