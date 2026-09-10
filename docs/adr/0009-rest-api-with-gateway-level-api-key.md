# 0009. REST API with a gateway-level API key, not a hand-rolled check

Date: 2026-09-10

## Status

Accepted

## Context

`POST /events` (the `ingest` handler) is a public HTTP endpoint. Left
completely open, anyone who finds the URL can send it garbage and burn
through the account's Lambda/SQS/DynamoDB usage. This is a portfolio
demo, not a product with real users, so it doesn't need real
authentication (accounts, JWTs, per-user identity) - it just needs
*something* between the internet and the Lambda so the endpoint isn't
wide open.

API Gateway comes in two flavors here: **HTTP API**, which is cheaper and
simpler but only supports Lambda authorizers or JWT for gating requests,
and **REST API**, which is pricier and has more knobs, but has API keys
and usage plans built in as a first-class gateway feature.

## Decision

The service uses API Gateway's **REST API**, specifically so the API key
check happens at the gateway, before a request ever reaches Lambda.
`serverless.yml` declares the key under `provider.apiGateway.apiKeys`
and marks the `/events` route `private: true` - that's the entire
implementation. `ingest`'s handler code never sees or checks a key;
API Gateway rejects an unkeyed or wrong-keyed request with a 403 on its
own.

## Consequences

No auth logic lives in application code, which is the point - the
`ingest` handler stays exactly what [0004](0004-service-assigns-event-identity.md)
and this handler's own design already say it should be: parse, enqueue,
done. A request without the key never spins up a Lambda invocation at
all, so bad requests cost nothing beyond a rejected API Gateway call.

This is explicitly a demo-scale safeguard, not real authentication. One
shared key gates the whole endpoint - anyone holding it can call it as
any `userId`, and there's no per-caller identity, rate limiting beyond
whatever usage plan gets attached, or key rotation story. That's fine
for a repo meant to demonstrate architecture, not for a real product
handling real user data; a production version of this service would
need actual per-caller auth, not a shared key.

It's also worth naming what a real production setup would look like
here, since this service being directly internet-facing is itself part
of the simplification. A service like this - internal, triggered by
other backend services rather than end users - normally wouldn't sit
behind a public API Gateway at all. It would live behind an internal
gateway or service mesh, reachable only from other trusted services
inside the same infrastructure, with authentication already handled
once, upstream, before the request ever gets anywhere near this
service. The API key here is a stand-in for that upstream auth,
scoped down to fit a single standalone demo repo - not the shape this
service's network exposure would actually take in a real deployment.

REST API also costs more per request than HTTP API and carries more
configuration surface generally. At this service's demo traffic that
difference is negligible, and it's the cost of getting the key check
enforced at the gateway instead of writing and testing that check by
hand in every Lambda that needs it.

## Alternatives considered

**HTTP API** was the default first choice - cheaper, simpler, and this
service uses none of REST API's other features (request validation,
usage plans beyond the key, WAF integration). It was set aside because
it has no equivalent to native API keys; gating a request would mean a
Lambda authorizer, which is its own Lambda function, its own IAM role,
and its own cold start on every request - more moving parts than a
single `provider.apiGateway.apiKeys` entry, to solve a problem REST API
already solves natively.

**A hand-rolled key check inside `ingest`** (compare a header against an
environment variable) was also considered and rejected - it would still
invoke a full Lambda for every request, including ones that are about to
be rejected, and it would put auth logic in the same file whose whole
design goal is staying thin.
