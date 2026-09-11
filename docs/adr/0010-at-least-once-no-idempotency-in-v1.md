# 0010. Accept at-least-once delivery; no deduplication in V1

Date: 2026-09-11

## Status

Accepted

## Context

SQS Standard queues (chosen in ADR 0006) only guarantee at-least-once
delivery, not exactly-once. Combined with the retry mechanism in
`processNotification` (ADR 0001, `ReportBatchItemFailures`,
`maxReceiveCount: 3`), there are a couple of real ways the same event
could end up processed twice:

- SQS itself can occasionally redeliver a message that was already
  successfully processed, even with no error involved - this is a known,
  documented property of Standard queues, not a bug to work around.
- More concretely here: `processRecord` calls `PushProvider.send()` and
  only logs/returns success *after* that call completes. If the push
  actually goes out but the Lambda then fails or times out before
  finishing (a crash, a thrown error further down, the invocation being
  killed), SQS never gets confirmation the message was handled and
  redelivers it - and the notification gets sent to the device a second
  time.

So a user could, in principle, get the same push notification twice.

## Decision

V1 accepts this and does nothing to prevent it - no idempotency key, no
dedup table, no "have I already sent this eventId" check before calling
`PushProvider.send()`.

This is a deliberate scope call, not an oversight: a duplicate push
notification is a minor annoyance (the user sees the same message
twice), not a data-corruption or double-charge problem. That's a
meaningfully different risk profile than, say, a payment or inventory
event, where at-least-once delivery without deduplication would be a
real bug. Nothing about this service's actual event types (a new
message, a reminder, etc.) makes a duplicate notification harmful enough
to justify the extra moving part.

## Consequences

Occasionally, rarely, a user might get the same notification twice. This
is undetected and unlogged as a distinct case - it just looks like two
independent successful sends, since there's nothing tracking "have I
seen this eventId before."

If this service ever needs to guarantee exactly-once delivery of a
notification - because a future event type actually is harmed by
duplicates - that would mean adding a dedup mechanism: for example, a
DynamoDB conditional write recording `eventId` before calling
`PushProvider.send()`, with a short TTL, so a redelivered message is
recognized and skipped rather than resent. That's a real, well-understood
pattern; it's just not built here because nothing in this service's
scope currently needs it.

## Alternatives considered

Adding the dedup table now, preemptively, was considered and set aside.
It's extra infrastructure (another table, another write on every
successful send, TTL cleanup to reason about) to solve a problem that,
for this service's actual event types, doesn't cause real harm. Building
it without a concrete need would be exactly the kind of speculative
complexity the rest of this service's design deliberately avoids.
