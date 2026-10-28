# Wicklib documentation

## Start here

- [Root README](../README.md) — project overview, packages, development, and releases.
- [`@wicklib/core`](../packages/core/README.md) — chart, series, annotations, themes, export.
- [`@wicklib/indicators`](../packages/indicators/README.md) — built-in indicator catalog.
- [`@wicklib/react`](../packages/react/README.md) — React wrapper and `useChart`.
- [`@wicklib/script`](../packages/script/README.md) — WickScript authoring and runtime.
- [`@wicklib/script-editor`](../packages/script-editor/README.md) — Monaco editor.

## Contracts and decisions

- [RFC index](./rfc/README.md) — accepted public API, datafeed, panes, drawings, sessions,
  overlays, annotations, themes, compatibility, and series contracts.
- [ADR-0001](./adr/0001-drawing-anchor-snapping.md) — drawing anchor snapping.
- [Script plan](../packages/script/PLAN.md) and [script ADRs](../packages/script/docs/adr/).

## Operations

- [Release procedure](./RELEASE.md) — prerelease, stable release, verification, and rollback.
- [Playground](../apps/playground/README.md) — controls, URL modes, fixtures, and visual tests.
- [Benchmark](../apps/playground/BENCHMARK.md) — rendering baseline and CI thresholds.

## Public package rules

- Free packages share one fixed Changesets release train.
- Public API changes require an accepted RFC or ADR and an API Extractor report diff.
- `@wicklib/core` has zero runtime dependencies and never imports sibling packages.
- Plugins declare `@wicklib/core` as a peer dependency.
