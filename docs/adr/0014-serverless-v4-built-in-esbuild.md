# 0014. Rely on Serverless Framework v4's built-in esbuild, not the serverless-esbuild plugin

Date: 2026-09-11

## Status

Accepted

## Context

Lambda handlers are written in TypeScript, so something has to bundle
`.ts` source into plain JavaScript before it can be deployed. The
original plan (written before any handler code existed) assumed the
`serverless-esbuild` plugin for this, since that used to be the standard
way to get esbuild bundling out of Serverless Framework.

Once real handler code existed and `bunx serverless print --stage dev`
was actually run with that plugin installed, it failed immediately with
an explicit error: Serverless Framework v4 now bundles esbuild
internally and detects that it conflicts with the separately-installed
`serverless-esbuild` plugin. This wasn't a guess or something read about
in advance - it was a real error surfaced by actually running the
command.

## Decision

`esbuild` and `serverless-esbuild` were removed entirely (`bun remove`,
plus deleting the `plugins:` and `custom.esbuild:` blocks from
`serverless.yml`), relying instead on Serverless v4's built-in
TypeScript bundling. No plugin, no separate esbuild config - `.ts`
handlers just get picked up and bundled automatically on
`package`/`deploy`.

This also meant cleaning up `package.json`'s `trustedDependencies` list,
which still had `@parcel/watcher` and `esbuild` in it from when those
packages were installed (`bun pm trust` had approved their postinstall
scripts) - stale entries pointing at dependencies that no longer existed
once the plugin was removed.

## Consequences

Fewer dependencies, no plugin-vs-framework version compatibility to
track, and one less place to configure - v4's own defaults handle
`.ts` bundling correctly, verified via a clean `serverless package`.

The trade-off: no exposed `custom.esbuild:` block means less direct
control over bundling specifics (target Node version, minification,
marking packages as external, etc.) than the plugin offered. Nothing in
this service currently needs that control. If it ever does, the place
to look first is whatever build-configuration surface Serverless v4
itself exposes for its built-in bundler - not reintroducing the old
plugin, which would immediately hit the same conflict again.

## Alternatives considered

Pinning to an older Serverless Framework v3 specifically to keep using
`serverless-esbuild` was considered and rejected - the project had
already committed to v4 as the current, maintained major version for
unrelated reasons, and downgrading it just to keep a now-redundant
plugin would mean giving up a current framework version to keep a
feature v4 already provides natively, under a different name.
