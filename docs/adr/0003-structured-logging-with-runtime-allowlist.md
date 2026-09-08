# 0003. Structured logging with a runtime-enforced field allowlist

Date: 2026-09-08

## Status

Accepted

## Context

Tracing a single event through this service — ingest, SQS, the worker,
the call to Expo — only works if every step logs in a way that can be
tied back together, and if nothing sensitive ends up in those logs. A
push token is exactly the kind of thing that's easy to log by accident:
it's right there in the data being processed, and `console.log(payload)`
during debugging is an easy habit that's hard to fully avoid once a
service has several handlers written by hand over time.

If logging is left to each handler to do its own way — whatever fields
seem useful at the time — two things tend to happen: the log shape
drifts between handlers, making a single event harder to trace, and
there's nothing stopping a token or other sensitive value from slipping
into a log line months from now, in a handler nobody's looking at
closely.

## Decision

A single `log()` function in `src/shared/logger.ts` is the only way this
service writes structured logs. It takes a `LogEntry` with a fixed,
closed set of fields — `eventId`, `eventType`, `userId`, `status`,
`durationMs`, and an optional `errorType` — and writes one JSON line to
stdout, which CloudWatch Logs picks up automatically for a Lambda
function; nothing extra needs to be configured or shipped.

The allowlist isn't just a TypeScript type, though. `log()` rebuilds the
entry field by field before serializing it, rather than serializing
whatever object it's handed. That means even if something bypasses the
type checker — a type assertion, a mistake — and tries to pass through
an extra field like a push token, it gets dropped before it ever reaches
`JSON.stringify`. This is deliberate and it's tested directly: one of
the tests in `logger.test.ts` smuggles in a fake `pushToken` field on
purpose and asserts it never makes it into the output.

## Consequences

Every handler that logs through this function produces the exact same
shape, so a single `eventId` can be traced across the whole pipeline
without guessing what fields might or might not be present at each
step. And there's no code path — accidental or otherwise — that lets a
push token reach the logs through this function.

The cost is that adding a new field to what's logged means editing this
one type and function, rather than just typing an extra key into a log
call somewhere. That's the intended friction: every new loggable field
should be a deliberate decision, not something that slipped in.

## Alternatives considered

Calling `console.log(JSON.stringify(entry))` directly in each handler,
with whatever fields felt relevant at the time, was the simplest option
and was set aside because it's exactly the pattern that lets logging
drift and lets sensitive fields slip through — nothing stops a push
token from being included.

Pulling in a general-purpose logging library (Pino, Winston, and
similar) was also considered. It was set aside too: those libraries are
built for far more than this service needs — a handful of Lambda
functions writing one structured line per unit of work to stdout, which
CloudWatch already captures without any shipping or agent. A library
like that also wouldn't, on its own, stop a token from being logged
either — the closed-field, runtime-enforced approach here solves the
actual problem directly instead of adding a dependency that still
requires the same discipline on top of it.
