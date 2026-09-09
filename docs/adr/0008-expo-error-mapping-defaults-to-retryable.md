# 0008. Unrecognized Expo push errors default to retryable

Date: 2026-09-09

## Status

Accepted

## Context

[0001](0001-failure-classification.md) already splits failures into
retryable and not-retryable, based on typed errors
(`TransientProviderError`, `PermanentProviderError`). `ExpoPushProvider`
is where that classification actually has to happen for real, on real
error codes coming back from Expo's push service.

Expo reports several distinct error codes on a failed ticket -
`DeviceNotRegistered`, `MessageTooBig`, `MessageRateExceeded`,
`InvalidCredentials`, `DeveloperError`, `ExpoError`, `ProviderError` -
and each one technically deserves its own answer to "is retrying this
going to help?" `DeviceNotRegistered` clearly won't - the device is
gone, retrying just repeats the same failure forever. The others are
murkier: `MessageRateExceeded` should retry (it's transient by
definition), but `MessageTooBig` or a malformed request
(`DeveloperError`) won't fix itself by retrying either.

Building a complete, correct mapping for every one of these takes real
research into what each code actually means and how confidently that
maps to retryable-or-not - work that hasn't been done here yet, and
doing it half-right (guessing at a code's meaning) is worse than not
doing it at all.

## Decision

`ExpoPushProvider.send()` only special-cases the one error this service
is confident about: `DeviceNotRegistered` becomes a
`PermanentProviderError`, since a dead device is the whole reason
`classifyFailure` (0001) has a not-retryable, deactivate-the-token path.
Every other error code Expo can return - recognized or not - becomes a
`TransientProviderError`, and gets retried through SQS's normal
redrive/DLQ mechanism (0006) instead of being individually diagnosed.

## Consequences

A failure this service hasn't specifically reasoned about defaults to
"try again," not "give up." That's the safer direction to be wrong in:
retrying a message that was never going to succeed just costs a few
wasted attempts before it lands in the DLQ (maxReceiveCount: 3) for a
human to look at - it doesn't lose the notification or silently
deactivate a token that's actually still valid, which is what happens
if something gets miscategorized as permanent by mistake.

The real cost: a genuinely permanent failure that isn't
`DeviceNotRegistered` (say, `MessageTooBig`) still gets retried three
times before landing in the DLQ, instead of being caught immediately.
That's a few wasted Lambda invocations, not a correctness problem - and
it's cheaper than the alternative of guessing at codes this service
hasn't actually seen or reasoned through.

## Alternatives considered

Mapping every documented Expo error code individually to retryable or
not was considered and set aside for now - it's the more complete
answer, but it means committing to a judgment call on codes this
service has no real operational experience with. If a specific code
shows up often enough in practice to be worth a dedicated branch (the
DLQ is exactly where that evidence would show up), it can be added
then, backed by an actual observed failure instead of a guess.
