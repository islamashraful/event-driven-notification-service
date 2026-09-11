# 0012. Native CloudWatch alarms, on three specific signals, over a third-party APM

Date: 2026-09-11

## Status

Accepted

## Context

Structured logging (ADR 0003) answers "what happened to this specific
event" once someone already knows to look. It doesn't answer a different
question: how would anyone find out something is wrong in the first
place, without sitting there watching logs scroll by?

Something needs to actively watch the system and say "look at this,"
covering the ways this service can actually fail:

- The worker (`processNotification`) could start throwing errors -
  a bug, a permissions mistake, Expo being down.
- A message could exhaust its retries (`maxReceiveCount: 3`, ADR 0006)
  and land on the DLQ - meaning something failed 3 times running and
  nobody's looked at it yet.
- The worker could fall behind - not crashing, just not keeping up with
  incoming volume, so notifications sit queued longer than they should.

## Decision

Three CloudWatch alarms, each watching one of the AWS-provided metrics
already emitted for free by resources this service already has - no new
service, no new SDK, no code instrumentation required:

- **`ProcessNotificationErrorRateAlarm`** - `AWS/Lambda` `Errors` on
  `processNotification`, `Sum >= 1` over 5 minutes. Catches the worker
  actually crashing.
- **`DLQMessageCountAlarm`** - `AWS/SQS`
  `ApproximateNumberOfMessagesVisible` on `NotificationsDLQ`, fires on
  any message at all (`> 0`). A DLQ hit means the worker already gave up
  on something after 3 retries.
- **`QueueAgeAlarm`** - `AWS/SQS` `ApproximateAgeOfOldestMessage` on
  `NotificationsQueue`, threshold 300 seconds. Catches the worker falling
  behind, not crashing - deliberately age, not raw queue depth, since
  depth alone spikes normally during any burst that's draining fine;
  rising *age* is the actual "not keeping up" signal (see ADR 0011 for
  the concurrency mechanism this is checking on).

All three publish to one `AlertsTopic` SNS topic (`resources` in
`serverless.yml`) rather than each wiring its own notification path. No
email subscription is created in code - subscribing a real address is a
manual, post-deploy step, so a personal email address never ends up
committed to this public repo.

Each alarm uses `EvaluationPeriods: 1` (one bad 5-minute window is
enough to notify - no need to wait for a sustained breach at this
service's scale) and `TreatMissingData: notBreaching` (no invocations or
no messages in a window isn't a failure, it's just quiet).

## Consequences

Someone watching `AlertsTopic` finds out about a real problem within
about 5 minutes of it starting, without needing to actively watch
anything. The three alarms cover three genuinely different failure
shapes, so a "which thing actually broke" question is mostly answered by
which alarm fired, before ever opening CloudWatch Logs.

The gap: an alarm says *that* something's wrong, not *why*. Answering
"why" still means going to CloudWatch Logs and reading the structured
`{ eventId, eventType, userId, status, errorType }` lines from ADR 0003
- the alarm is the trigger to go look, not a replacement for looking.

## Alternatives considered

A third-party APM/observability platform (Datadog, Sentry, etc.) was
considered and set aside. It's a real, more capable option for a system
at real production scale - dashboards, tracing, smarter anomaly
detection - but it's a paid service, another account and API key to
manage, and more than this service's actual demo-scale failure modes
need. The three signals above cover the concrete ways this specific
service fails; native CloudWatch alarms answer that with zero extra
infrastructure or cost.
