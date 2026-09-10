import { describe, expect, it } from "bun:test";
import type { NotificationEvent } from "../../src/domain/events";
import { ingest } from "../../src/functions/ingest/handler";
import type { SqsEventQueue } from "../../src/infrastructure/sqs/sqs-event-queue";

function fakeQueue(enqueued: NotificationEvent[]): SqsEventQueue {
  return {
    enqueue: async (event) => {
      enqueued.push(event);
    },
  } as SqsEventQueue;
}

const validBody = JSON.stringify({
  userId: "a1b2c3d4-e5f6-4789-a012-3456789abcde",
  eventType: "NEW_MESSAGE",
  data: { senderName: "Alex" },
});

describe("ingest", () => {
  it("enqueues a normalized event and returns 202", async () => {
    const enqueued: NotificationEvent[] = [];
    const result = await ingest(fakeQueue(enqueued), validBody);

    expect(result.statusCode).toBe(202);
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]?.eventType).toBe("NEW_MESSAGE");
    expect(enqueued[0]?.eventId).toMatch(/^evt_/);
    expect(JSON.parse(result.body).eventId).toBe(enqueued[0]?.eventId);
  });

  it("returns 400 without enqueuing when the body isn't valid JSON", async () => {
    const enqueued: NotificationEvent[] = [];
    const result = await ingest(fakeQueue(enqueued), "not json");

    expect(result.statusCode).toBe(400);
    expect(enqueued).toHaveLength(0);
  });

  it("returns 400 without enqueuing when the body fails schema validation", async () => {
    const enqueued: NotificationEvent[] = [];
    const result = await ingest(fakeQueue(enqueued), JSON.stringify({ eventType: "NEW_MESSAGE" }));

    expect(result.statusCode).toBe(400);
    expect(enqueued).toHaveLength(0);
  });

  it("returns 400 without enqueuing when the body is missing entirely", async () => {
    const enqueued: NotificationEvent[] = [];
    const result = await ingest(fakeQueue(enqueued), null);

    expect(result.statusCode).toBe(400);
    expect(enqueued).toHaveLength(0);
  });
});
