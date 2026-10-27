# Wicklib

Open-source charting engine for web applications. Canvas-first, framework-agnostic, and
designed for a clean separation between the free engine and the commercial add-on.

**Status: Phase 2 complete.** A candlestick chart renders real data with axes, crosshair,
pan, zoom, keyboard and pinch interactions, and an async series-level datafeed. Phase 3
starts with indicators and drawings. WickTS comes later.

## Try it

```sh
pnpm install
pnpm dev
```

Opens the private playground at `localhost:5173` with 5k / 25k / 100k synthetic 1m bars, a
crosshair OHLC readout, a theme toggle, an FPS meter, and a "Use feed" mode with a simulated
async feed and live bars. Keyboard: arrows pan, `+`/`-` zoom, `Home` fits. Pinch zoom works
on touch. Core edits hot-reload.

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
pnpm test:visual   # Playwright snapshot + 100k-bar benchmark
```

`pnpm checks` runs the same sequence CI runs. Visual tests need Chromium once:
`pnpm --filter @wicklib/playground exec playwright install chromium`. Node 24 and pnpm 10
are required.

## Architecture rules

- `@wicklib/core` has zero runtime dependencies and imports nothing from sibling packages.
- Every plugin declares `@wicklib/core` as a peer dependency, so exactly one registry
  instance exists at runtime.
- All free packages share one fixed release train.
- Public API changes are gated by API Extractor; the report in `packages/core/etc` is
  reviewed like code.
- The site consumes published packages only; `apps/playground` is the local dev harness.

See `docs/rfc/0001-public-api.md` and `docs/rfc/0002-datafeed.md` for the accepted public
API and datafeed contracts, `apps/playground/BENCHMARK.md` for the rendering baseline, and
`packages/script/PLAN.md` plus its ADRs for the scripting design that is frozen but not yet
implemented.

## Releasing

Publishing is **manual**: run the `release` workflow from the Actions tab. It uses npm
trusted publishing (OIDC) with provenance; no `NPM_TOKEN` is stored.

The alpha line uses the `next` tag. Enter prerelease mode once with
`pnpm changeset pre enter next`; exit with `pnpm changeset pre exit` before the first stable
release.

1. Add a changeset with `pnpm changeset`.
2. Version with `pnpm changeset version`, or merge the Changesets version PR.
3. Commit the version changes and push.
4. Run the `release` workflow manually.

The initial `0.1.0-dev.0` versions were published manually. `latest` stays on them until a
stable release; install the alpha with `@next` or an exact version.

## License

Apache-2.0. See [LICENSE](./LICENSE).
