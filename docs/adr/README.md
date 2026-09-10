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
| [0003](0003-structured-logging-with-runtime-allowlist.md) | Structured logging with a runtime-enforced field allowlist | Accepted |
| [0004](0004-service-assigns-event-identity.md) | The service assigns eventId and receivedAt — producers never do | Accepted |
| [0005](0005-lambda-over-ec2-ecs.md) | AWS Lambda instead of EC2, ECS, or Kubernetes | Accepted |
| [0006](0006-sqs-standard-over-fifo-decoupling.md) | SQS as the decoupling boundary, and Standard over FIFO | Accepted |
| [0007](0007-dynamodb-single-table-on-demand.md) | A single DynamoDB table, keyed by userId, on on-demand billing | Accepted |
| [0008](0008-expo-error-mapping-defaults-to-retryable.md) | Unrecognized Expo push errors default to retryable | Accepted |
| [0009](0009-rest-api-with-gateway-level-api-key.md) | REST API with a gateway-level API key, not a hand-rolled check | Accepted |

More records will be added here as the implementation progresses.
