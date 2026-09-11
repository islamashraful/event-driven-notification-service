# 0011. Partial batch failure, plus reserved concurrency as the one concurrency knob

Date: 2026-09-11

## Status

Accepted

## Context

`processNotification` is triggered by SQS with `batchSize: 10` - each
invocation gets up to 10 messages at once, not one. Two separate
problems come from that:

**Problem 1 - an all-or-nothing batch is wasteful.** By default, if a
Lambda invocation throws, SQS treats the *entire batch* as failed and
redelivers all of it - including the 9 messages that were actually
processed successfully. At any real volume, that means a lot of
notifications get sent twice (see ADR 0010) just because one unrelated
message in the same batch happened to fail.

**Problem 2 - a burst of events shouldn't hammer Expo.** SQS will
happily scale up how many `processNotification` invocations run
concurrently as the queue grows, each one calling out to Expo. Without a
cap, a large burst of incoming events could turn into a large burst of
simultaneous outbound calls to Expo - not something either Expo or this
service needs to survive at once. (Expo itself documents a real limit
here: 600 notifications per second per project - see
[Expo's push notification
FAQ](https://docs.expo.dev/push-notifications/faq/#limit-of-sending-notifications),
checked 2026-09-11. `reservedConcurrency: 5` sits nowhere near that
ceiling at this service's demo scale, but it's the reason a cap belongs
here at all, not just an arbitrary number.)

## Decision

Two separate, independent mechanisms - one per problem:

**Partial batch failure.** The event source is configured with
`functionResponseType: ReportBatchItemFailures`. The handler processes
each record, catches failures per-record, and returns
`{ batchItemFailures: [{ itemIdentifier }] }` listing only the
`messageId`s that actually failed (see
`src/functions/process-notification/handler.ts`). SQS uses this to
redeliver only those specific messages - the ones that already succeeded
are left alone.

**Bounded concurrency via `reservedConcurrency: 5`.** This is the only
concurrency knob in the system. It caps how many `processNotification`
invocations can run *at the same time, across the whole account* -
which directly bounds how many simultaneous calls can reach Expo,
regardless of how many messages are sitting in the queue. Inside a single
invocation, the 10 records in its batch are processed one at a time, in
a plain sequential loop - there's no second concurrency mechanism
layered inside that loop (e.g. no `Promise.all` with its own limiter).
One knob, one place, doing the actual bounding.

## Consequences

A burst of events queues up in SQS and drains at a predictable, bounded
rate, instead of turning into an unbounded spike of concurrent Expo
calls - this is the concrete mechanism behind "SQS absorbs bursts, the
worker drains them at a controlled pace." If the queue can't drain fast
enough at `reservedConcurrency: 5`, the `QueueAgeAlarm` CloudWatch alarm
(see `serverless.yml`) is the signal that catches it, not a mystery
slowdown.

The cost: within one invocation, records are handled one at a time, so a
slow or blocked record delays the rest of that same batch. Other
batches, running in other concurrent invocations, aren't affected - only
work inside a single invocation is serialized. At this service's scale,
that's a fine trade for the simplicity of having exactly one place that
controls concurrency.

## Alternatives considered

Adding a second, in-invocation concurrency limiter (processing the 10
records in a batch concurrently, capped at some smaller number) was
considered and rejected. It would mean reasoning about two multiplying
concurrency numbers instead of one (`reservedConcurrency` × an in-batch
limit), for no real benefit here - `reservedConcurrency` already caps
total concurrent Expo calls system-wide, which is the thing that
actually matters. A second knob would only add complexity without
tightening that bound any further.
