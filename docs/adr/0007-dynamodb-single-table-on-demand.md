# 0007. A single DynamoDB table, keyed by userId, on on-demand billing

Date: 2026-09-09

## Status

Accepted

## Context

The worker needs a way to look up a user's push token before it can send
them a notification, and something needs to hold that token whenever a
user registers or updates it. That's the only real access pattern this
service has right now: given a `userId`, get their current token.

Whatever stores this also has to make a call on how much read/write
capacity to provision. Traffic here is bursty and low-volume - long
quiet stretches with occasional spikes when a batch of events comes
in - which makes guessing a fixed capacity number ahead of time more
guesswork than engineering.

## Decision

A single DynamoDB table, `PushTokensTable`, with `userId` as the
partition key and nothing else. Billing mode is `PAY_PER_REQUEST`
(on-demand) instead of provisioned capacity.

One table with one key is enough because there's exactly one access
pattern (lookup by `userId`) and no relationships between different
kinds of data that would call for a second table or a secondary index.

## Consequences

There's no capacity number to pick, watch, or get wrong - the table
scales with whatever traffic actually shows up, and cost tracks actual
usage instead of a reserved ceiling. At this service's current demo
scale (bursty, low-volume), that's a non-issue in itself, but the same
property holds at the other end too: on-demand billing is DynamoDB's
own answer for unpredictable and rapidly-growing traffic, and it scales
up automatically into the millions-of-requests range without anyone
provisioning anything ahead of time. Choosing it here isn't a
small-scale-only shortcut - it's the option that already holds up if
this service's real traffic grew by orders of magnitude, with no
schema or billing-mode change required to get there.

The tradeoff: on-demand is more expensive per request than well-tuned
provisioned capacity at sustained, predictable high volume - paying for
elasticity you're not using. That's a cost worth paying here, since
this service's traffic is neither sustained nor predictable, and it's
a cost that scales down to near-zero at low volume just as cleanly as
it scales up.

## Alternatives considered

Provisioned capacity (with or without auto-scaling) was considered and
set aside - it solves a problem (controlling cost at high, predictable
volume) this service doesn't have, at the price of a capacity number
that would either be guessed wrong or need ongoing attention.

A second table, or a secondary index, for some other access pattern
(e.g. looking up tokens by platform, or listing all tokens for a
cleanup sweep) wasn't added, since the only query this service actually
runs is a lookup by `userId`. A full table scan is enough for the
cleanup job's occasional stale-token sweep at this scale; a secondary
index isn't worth the added write cost until an access pattern actually
needs one.
