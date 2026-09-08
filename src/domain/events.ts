import { randomUUID } from "node:crypto";
import { z } from "zod";

/**
 * What an external backend service actually sends us. No eventId, no
 * timestamp — producers only describe what happened; this service assigns
 * identity and provenance when it normalizes the request.
 */
const baseRequestFields = {
  userId: z.string().uuid(),
};

const campaignApprovedRequest = z.object({
  ...baseRequestFields,
  eventType: z.literal("CAMPAIGN_APPROVED"),
  data: z.object({
    campaignId: z.string().uuid(),
  }),
});

const campaignRejectedRequest = z.object({
  ...baseRequestFields,
  eventType: z.literal("CAMPAIGN_REJECTED"),
  data: z.object({
    campaignId: z.string().uuid(),
  }),
});

const newMessageRequest = z.object({
  ...baseRequestFields,
  eventType: z.literal("NEW_MESSAGE"),
  data: z.object({
    senderName: z.string().min(1),
  }),
});

export const incomingEventRequestSchema = z.discriminatedUnion("eventType", [
  campaignApprovedRequest,
  campaignRejectedRequest,
  newMessageRequest,
]);

export type IncomingEventRequest = z.infer<typeof incomingEventRequestSchema>;

export type ParseRequestResult =
  | { success: true; request: IncomingEventRequest }
  | { success: false; error: string };

/** Validates the raw request body from an external producer. */
export function parseIncomingEvent(raw: unknown): ParseRequestResult {
  const result = incomingEventRequestSchema.safeParse(raw);
  if (result.success) {
    return { success: true, request: result.data };
  }
  return { success: false, error: result.error.message };
}

/**
 * The event as it travels through this service from here on: what a
 * producer sent, plus the identity and provenance this service assigns.
 * This is the shape written to SQS.
 */
export type NotificationEvent = IncomingEventRequest & {
  eventId: string;
  receivedAt: string;
};

/** Assigns identity/provenance to a validated request. */
export function normalizeEvent(request: IncomingEventRequest): NotificationEvent {
  return {
    ...request,
    eventId: `evt_${randomUUID()}`,
    receivedAt: new Date().toISOString(),
  };
}
