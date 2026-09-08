# Architecture Decision Records

This directory records the significant decisions behind how this service
is built — not just what was built, but why, and what else was
considered. The goal is for anyone reading the code to be able to answer
"why is it done this way?" without having to guess or ask.

Each record follows the standard [Nygard ADR
format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions):
**Context** (the problem, before any decision was made), **Decision**
(what was chosen), **Consequences** (what that costs and what it buys),
and **Alternatives considered** where there's a genuine "why not X"
worth answering.

A record is written once a decision is made and its code exists — not
drafted in advance and not reconstructed after the fact from memory. If
a decision is later replaced, the old record stays as-is and a new one
supersedes it, so the reasoning behind a past choice — and why it
changed — stays visible.

## Index

| # | Decision | Status |
|---|---|---|
| [0001](0001-failure-classification.md) | Classify failures into retry, DLQ, or token-deactivation | Accepted |
| [0002](0002-domain-depends-on-ports.md) | Domain code depends on ports, not on AWS or Expo directly | Accepted |

More records will be added here as the implementation progresses.
