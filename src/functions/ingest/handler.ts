import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { normalizeEvent, parseIncomingEvent } from "../../domain/events";
import { SqsEventQueue } from "../../infrastructure/sqs/sqs-event-queue";
import { requiredEnv } from "../../shared/env";
import { log } from "../../shared/logger";

/**
 * Parses, normalizes, and enqueues an incoming event. No notification text
 * is built here - this stage only decides "is this request well-formed"
 * and "did it reach the queue," and returns immediately. Building the
 * actual notification content is the worker's job.
 */
export async function ingest(
  queue: SqsEventQueue,
  rawBody: string | null,
): Promise<APIGatewayProxyResult> {
  const startedAt = Date.now();

  let body: unknown;
  try {
    body = rawBody === null ? undefined : JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Request body must be valid JSON" }) };
  }

  const parsed = parseIncomingEvent(body);
  if (!parsed.success) {
    return { statusCode: 400, body: JSON.stringify({ error: parsed.error }) };
  }

  const event = normalizeEvent(parsed.request);
  await queue.enqueue(event);

  log({
    eventId: event.eventId,
    eventType: event.eventType,
    userId: event.userId,
    status: "success",
    durationMs: Date.now() - startedAt,
  });

  return { statusCode: 202, body: JSON.stringify({ eventId: event.eventId }) };
}

// Built lazily, on first invocation, so importing this module (e.g. from a
// test) doesn't require QUEUE_URL to be set - only actually handling a
// request does.
let queue: SqsEventQueue | undefined;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  queue ??= new SqsEventQueue(requiredEnv("QUEUE_URL"));
  return ingest(queue, event.body);
}
