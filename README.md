# Wicklib

Open-source charting engine for web applications. Canvas-first, framework-agnostic, and
designed for a clean separation between the free engine and the commercial add-on.

**Status: Phase 2 — rendering vertical slice.** A candlestick chart renders real data with
axes, crosshair, pan, and zoom. Datafeed, indicators, and WickTS are not implemented yet.

## Try it

```sh
pnpm install
pnpm dev
```

Opens the private playground at `localhost:5173` with 5k / 25k / 100k synthetic 1m bars, a
crosshair OHLC readout, a theme toggle, and an FPS meter. Core edits hot-reload.

## Packages

| Package                  | Status         | Description                                                     |
| ------------------------ | -------------- | --------------------------------------------------------------- |
| `@wicklib/core`          | vertical slice | Canvas2D scales, candlestick series, axes, crosshair, pan, zoom |
| `@wicklib/indicators`    | planned        | Built-in indicator catalog                                      |
| `@wicklib/react`         | stubbed        | Thin React wrapper                                              |
| `@wicklib/script`        | planned        | WickScript (TypeScript for charts) runtime                      |
| `@wicklib/script-editor` | planned        | Monaco integration                                              |
| `wicklib`                | stubbed        | Umbrella package: core + indicators                             |

The commercial add-on (`@wicklib/pro`) lives in a separate private repository and consumes
`@wicklib/core` through its published entrypoint only.

## Development

```sh
pnpm dev          # playground
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm depcruise
pnpm api
pnpm checks
```

`pnpm checks` runs the same sequence CI runs. Node 24 and pnpm 10 are required.

## Architecture rules

- `@wicklib/core` has zero runtime dependencies and imports nothing from sibling packages.
- Every plugin declares `@wicklib/core` as a peer dependency, so exactly one registry
  instance exists at runtime.
- All free packages share one fixed release train.
- Public API changes are gated by API Extractor; the report in `packages/core/etc` is
  reviewed like code.
- The site consumes published packages only; `apps/playground` is the local dev harness.

See `docs/rfc/0001-public-api.md` for the accepted public API contract, and
`packages/script/PLAN.md` plus its ADRs for the scripting design that is frozen but not yet
implemented.

## License

Apache-2.0. See [LICENSE](./LICENSE).
