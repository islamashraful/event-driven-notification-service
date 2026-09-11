# 0013. EventBridge only runs the cleanup cron - it isn't this service's event bus

Date: 2026-09-11

## Status

Accepted

## Context

This service is named "event-driven-notification-service," and
EventBridge is AWS's dedicated event bus product - so its near-total
absence from the actual event flow is worth explaining rather than
leaving as a silent gap someone has to notice and ask about.

The only place EventBridge actually appears is `cleanup`'s trigger:
`events: - schedule: rate(1 day)` in `serverless.yml`. That's it. The
real event flow - `ingest` receiving a request, handing it to
`processNotification` - runs entirely through SQS (ADR 0006), not
through EventBridge at all.

## Decision

EventBridge is used here for exactly one thing: firing `cleanup` once a
day, because a scheduled (`rate(...)` / `cron(...)`) trigger for a
Lambda is what EventBridge is built to do, and Serverless Framework
generates that `AWS::Events::Rule` automatically from the `schedule:`
shorthand. Nothing more is asked of it.

The actual event handoff between `ingest` and `processNotification`
deliberately goes through SQS, not EventBridge - that decision, and why
SQS fits better, is already covered in ADR 0006 and isn't repeated here.
The short version of why EventBridge wasn't the right fit for that
handoff: EventBridge's real strength is pattern-matching one event out
to multiple independent consumers (fan-out, routing rules). This service
has exactly one consumer for a notification event - the worker - so
there's no routing or fan-out problem for EventBridge to solve. SQS's
plain point-to-point queueing, with its DLQ and redelivery model, is a
closer match to what's actually needed here: one producer, one
consumer, reliable delivery.

## Consequences

Someone reading "event-driven" in the name and expecting EventBridge to
be the backbone will be looking in the wrong place - this ADR is that
signpost. The name refers to the service reacting to external events
(a `NEW_MESSAGE`, a reminder, etc.) arriving via `POST /events`, not to
EventBridge specifically being the transport.

If a future version of this service needed to fan a single event out to
multiple independent consumers (say, a notification *and* an analytics
pipeline both reacting to the same incoming event), that's exactly the
shape of problem EventBridge is built for, and it would be the natural
tool to reach for then - just not for the single producer/single
consumer flow this service has today.

## Alternatives considered

Using EventBridge instead of SQS as the boundary between `ingest` and
`processNotification` was the real alternative here. It was set aside
because EventBridge is built around pattern-matching one event out to
however many independent rules/consumers care about it - there's no
built-in retry-with-backoff-and-DLQ model the way SQS has one baked in
(ADR 0006), and this service has exactly one consumer for a notification
event anyway, so there's no fan-out problem to justify reaching for it.
SQS's queue-plus-DLQ model is a closer match to "one producer, one
consumer, reliable delivery with retries" than EventBridge's
rule-based routing is.
