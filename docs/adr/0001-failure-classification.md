# 0001. Classify failures into retry, DLQ, or token-deactivation

Date: 2026-09-08

## Status

Accepted

## Context

When sending a notification fails, it's not one kind of failure — it's
several, and they need different responses. Expo might just be down for
a minute (worth retrying). A device's push token might be dead for good
(Expo will keep saying `DeviceNotRegistered` no matter how many times it's
retried — retrying is pointless). The incoming event itself might be
malformed. Or the user might not have a token registered at all.

Treating all of these the same way — always retry, or never retry — ends
up either hammering Expo with retries that can never succeed, or quietly
dropping a message that would've gone through fine on the next attempt.

And without a single place that makes this decision, it tends to sprawl:
every handler that can fail grows its own try/catch and its own opinion
about what counts as retryable, and those opinions quietly drift apart
over time.

## Decision

The service uses a small set of typed errors (`ValidationError`,
`NotFoundError`, `TransientProviderError`, `PermanentProviderError`, in
`src/shared/errors.ts`) and one function, `classifyFailure(error)` (in
`src/domain/failure-classification.ts`), that looks at whatever error was
thrown and decides what should happen next:

- **`TransientProviderError`** → retry it. SQS and Lambda already handle
  this via the visibility timeout; if it keeps failing past
  `maxReceiveCount`, it lands in the DLQ on its own.
- **`PermanentProviderError`** (Expo's `DeviceNotRegistered`, for
  example) → don't retry. Instead, the worker deactivates that token —
  no point retrying something that can never succeed.
- **`ValidationError` / `NotFoundError`** → don't retry. A malformed
  payload or a missing token won't fix itself on attempt two.
- **Anything unrecognized** → retry by default. An error the service
  doesn't understand should keep retrying — and eventually surface in the
  DLQ for a human to look at — rather than silently vanish.

The infrastructure code that actually talks to Expo or DynamoDB is
responsible for throwing the right typed error instead of letting a raw
SDK error leak through. `classifyFailure` only knows how to reason about
these four types, plus that safe fallback for everything else.

## Consequences

Every handler that can fail runs through the same function, so the
retry/DLQ/deactivation logic lives in one tested place instead of being
reinvented per handler. The `retryable` flag maps directly to whether the
worker tells SQS "retry this one" via `ReportBatchItemFailures` —
genuine failures get redelivered, everything else is treated as handled.

The catch: this is only as good as the errors thrown into it. If an
adapter lets a raw, unclassified error slip through, nothing breaks — it
just falls into the "unknown, so retry" bucket — but that's a weaker
signal than deciding on purpose. Adapters should translate
provider-specific errors deliberately rather than let them leak through
unclassified.

## Alternatives considered

Having `PushProvider.send()` return a result value instead (something
like `{ outcome: "sent" | "invalid-token" | "transient-error" }`) rather
than throwing was considered. It was set aside because it only covers
failures from the push provider — a DynamoDB error or a validation error
would still need separate handling somewhere else. Throwing typed errors
lets one function classify failures the same way no matter where they
came from.
