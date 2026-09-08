# 0002. Domain code depends on ports, not on AWS or Expo directly

Date: 2026-09-08

## Status

Accepted

## Context

The domain layer needs to do two things that reach outside the process:
send a push notification, and look up (or update) a user's push token.
The obvious way to do that is to just call the Expo SDK and the AWS SDK
directly from the code that decides what to send and to whom.

The problem with that: it welds business logic to a specific vendor.
Testing "does this event produce the right notification content" would
mean mocking AWS calls that have nothing to do with the actual question
being tested. And if the push provider or the storage layer ever needs
to change — a second push provider for a different platform, say, or a
different database — that change would ripple into code that's supposed
to be about business rules, not infrastructure.

## Decision

Two interfaces live in `src/domain/ports.ts`: `PushProvider` (one
method, `send(pushToken, content)`, which resolves on success and throws
the typed errors from [0001](0001-failure-classification.md) on
failure) and `PushTokenRepository` (get, save, deactivate, delete, and
find-stale operations on a user's token). Nothing in `domain/` imports
the AWS SDK or the Expo client — it only ever sees these two interfaces.

The concrete implementations — an `ExpoPushProvider`, a DynamoDB-backed
token repository — belong in `infrastructure/` and haven't been built
yet. When they are, they'll satisfy these same interfaces, and nothing
in `domain/` will need to change for that to happen.

Both interfaces are kept small on purpose: only the operations the
domain layer actually calls, not a general-purpose wrapper around
everything Expo's SDK or DynamoDB's API can do.

## Consequences

Domain code can be tested with plain in-memory fakes instead of mocked
AWS SDK clients — which is exactly what's already happening in
`notification-builder.test.ts` and `failure-classification.test.ts`:
zero mocking, because there's nothing external to mock at that layer.

Adding a second push provider later (FCM or APNs, say) means writing a
new adapter that implements `PushProvider` — it doesn't touch anything
in `domain/`. The same goes for swapping out how tokens are stored.

The cost is one extra layer of indirection: a handler calling
`pushProvider.send(...)` instead of the Expo client directly. For a
service this size that's a small price, and it's also the concrete
reason business-logic tests here don't need AWS mocking while adapter
tests (once they exist) will.

## Alternatives considered

Calling the Expo SDK and AWS SDK directly from domain code was the
simpler option on paper — fewer files, no interfaces to maintain. It was
set aside because it would force every domain-logic test to mock AWS
calls unrelated to what's actually being tested, which runs against how
this project wants its tests to work: business logic tested with no
AWS involved at all, AWS mocking reserved for the adapters that
genuinely talk to AWS.
