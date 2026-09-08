# 0004. The service assigns eventId and receivedAt — producers never do

Date: 2026-09-08

## Status

Accepted

## Context

A producer calling this service only describes what happened —
something like `{ eventType, userId, data }`. Nothing in that request
identifies the event itself or says when it arrived. But downstream,
tracing an event through logs (see
[0003](0003-structured-logging-with-runtime-allowlist.md)) depends on
having a stable ID to search for, and knowing when the event was
actually received matters for debugging and for the stale-token cleanup
job later on.

The obvious way to get an ID is to let the producer send one. That
means trusting every producer to always generate a valid, unique value
— and if one doesn't, or two producers happen to pick the same ID, the
event gets logged and traced incorrectly, in a way that's hard to
notice until it actually causes confusion.

## Decision

The request schema a producer sends (`parseIncomingEvent` in
`src/domain/events.ts`) has no `eventId` field at all. If a producer
sends one anyway, it's silently dropped, not read and not trusted.

A separate step, `normalizeEvent()`, takes that validated request and
assigns `eventId` (a generated, prefixed UUID: `evt_<uuid>`) and
`receivedAt` (the timestamp at the moment of normalization) before the
event goes anywhere else — including onto SQS. From that point on,
every event in the system has both fields, always, with no missing or
producer-supplied case to account for.

## Consequences

Every event that reaches the queue and the worker is guaranteed to have
a well-formed, unique ID and an accurate received time — there's no
code path where either is missing or came from somewhere untrusted. Log
correlation, which depends entirely on `eventId` being trustworthy,
works the same way for every event without special-casing.

The tradeoff: if a producer calls the API twice with the same logical
event (a retry on their end, say), each call gets its own `eventId` —
there's no way to recognize "this is the same event as before" from the
ID alone, since the ID isn't something the producer controls. That's
an accepted characteristic of this design, not an oversight — this
service already treats occasional duplicate notifications as low-risk
and doesn't implement deduplication in V1 (a separate decision, to be
recorded once that logic actually exists in code).

## Alternatives considered

Accepting a producer-supplied `eventId` when present, and only
generating one as a fallback, was considered. It was set aside because
it makes correctness depend on every producer behaving well — sending
a properly unique value every time — rather than guaranteeing it
outright. Never trusting the caller for this field is simpler and
removes an entire category of bug.
