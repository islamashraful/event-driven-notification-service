# 0005. AWS Lambda instead of EC2, ECS, or Kubernetes

Date: 2026-09-08

## Status

Accepted

## Context

Every piece of compute this service needs — validating and enqueuing an
incoming event, sending a push notification, cleaning up stale tokens —
runs for a few hundred milliseconds to a few seconds, triggered by
something external (an HTTP request, a queue message, a daily
schedule). None of it needs to run continuously, hold state in memory
between requests, or share a process with anything else.

Running that kind of workload on EC2, ECS, or Kubernetes means owning a
machine (or a fleet of them) that's up all the time whether or not
there's traffic: patching it, monitoring whether it's healthy, deciding
how it scales up and down, and paying for it around the clock. For a
workload that's genuinely bursty — long stretches of nothing punctuated
by spikes — that's a lot of ongoing operational weight for something
that spends most of its time idle.

## Decision

This service runs entirely on Lambda. Each unit of work — the ingest
handler, the worker that sends notifications, the scheduled cleanup —
is its own function, invoked only when there's something to do, scaling
up automatically when a burst of events arrives and back down to zero
when there isn't.

## Consequences

There's no server to patch, provision, or keep healthy, and no cost
while nothing is happening — the service pays only for actual
invocations. Scaling under a burst of traffic is handled by the
platform rather than by anything this service has to configure or
watch.

The tradeoff is less control over the execution environment: no long-
lived in-memory cache between invocations to rely on, a cold-start delay
on the first request after idle time, and a hard per-invocation timeout.
None of those are real problems for this service — nothing here needs
sub-second guaranteed latency or a long-lived process — but they're the
honest cost of this choice, not something to gloss over.

## Alternatives considered

Running this on ECS (or EKS) was considered, mainly for finer control
over the runtime and to avoid cold starts entirely. It was set aside
because that control isn't needed here — this workload doesn't do
anything that benefits from a long-running process — and it would mean
taking on cluster and container orchestration for a handful of
short-lived functions that don't need it.

Plain EC2 was also considered and rejected for the same reason, with an
extra cost on top: owning the machine itself — provisioning it, patching
it, deciding when to turn it on or off — none of which this workload's
actual shape calls for.
