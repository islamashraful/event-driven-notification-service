# 0006. SQS as the decoupling boundary, and Standard over FIFO

Date: 2026-09-08

## Status

Accepted

## Context

The ingest Lambda's job is to accept an event and say "got it" quickly.
Actually sending a push notification takes longer, depends on an
external service (Expo), and can fail in ways that need retrying. If
the ingest Lambda tried to do both — accept the request and send the
notification — a slow or failing Expo call would directly slow down or
fail the producer's request, even though the producer only needed to
know the event was received.

Something needs to sit between "event received" and "notification
sent" so those two things can happen independently, at their own pace,
with retries handled without the producer ever knowing about them.

Once that queue exists, it also has to be one of two flavors: an SQS
FIFO queue, which guarantees strict ordering and exactly-once
processing but caps throughput and adds complexity, or a Standard
queue, which allows messages to arrive out of order and occasionally
more than once, in exchange for much higher throughput and no ordering
machinery to reason about.

## Decision

An SQS Standard queue (`NotificationsQueue` in `serverless.yml`) sits
between the ingest Lambda and the worker. The ingest Lambda's entire job
becomes: validate the request, drop the (now-identified — see
[0004](0004-service-assigns-event-identity.md)) event onto this queue,
and return. The worker picks messages up independently, at whatever
pace it can sustain, with SQS handling retries on failure.

Standard, not FIFO, because nothing about notifications requires strict
ordering — if two notifications for the same user arrive slightly out
of order, nothing breaks — and occasional duplicate delivery is an
accepted tradeoff already recorded as part of this service's design
(no idempotency in V1). FIFO's guarantees aren't needed here, and its
lower throughput ceiling isn't worth trading for them.

A dead-letter queue (`NotificationsDLQ`) is attached via a redrive
policy with `maxReceiveCount: 3` — a message that fails to process
three times moves there instead of retrying forever, so it can be
inspected rather than silently looping. While a worker is handling a
message, SQS hides it from everyone else for a set window —
`VisibilityTimeout`, set to 60 seconds here — and only puts it back up
for grabs if that window passes without the worker marking it done. 60
seconds is set well above how long processing one message is actually
expected to take (defined once the worker Lambda itself is), so SQS
doesn't hand the same message to a second worker while the first one is
still legitimately working on it.

## Consequences

The producer-facing endpoint stays fast and simple regardless of how
long sending the actual notification takes or how many times it needs
to retry — that latency is fully hidden behind the queue. A burst of
incoming events doesn't overwhelm Expo directly; it queues up and
drains at whatever rate the worker can sustain.

The cost of Standard over FIFO: notifications can arrive slightly out
of order, and the same notification can occasionally be delivered
twice. Both are treated as acceptable here, not ignored — they're the
direct, deliberate tradeoff being made for simplicity and throughput.

## Alternatives considered

An SQS FIFO queue was considered, mainly for its exactly-once
processing guarantee. It was set aside because nothing in this
service's actual requirements needs ordering or exactly-once delivery,
and FIFO's lower throughput ceiling and added complexity (message
group IDs, deduplication IDs) would be paid for a guarantee this
service doesn't use.

Skipping a queue entirely — having the ingest Lambda call Expo directly
— was also considered and rejected: it would tie the producer's request
latency to Expo's, and remove the natural place for retry logic to
live without the producer ever seeing it.
