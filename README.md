# Wicklib

Open-source charting engine for web applications. Canvas-first, framework-agnostic, and
designed for a clean separation between the free engine and the commercial add-on.

**Status: Phase 3 complete — core chart, indicators, panes, drawings, and React.**
A candlestick chart renders real data with axes, crosshair, pan, zoom, keyboard and pinch
interactions, an async series-level datafeed, multiple panes, seven built-in indicators, five
drawing tools, a React wrapper, session-aware labels/gaps, and the first WickScript API v1
compiler slice. The sandboxed script runtime comes next.

## Try it

```sh
pnpm install
pnpm dev
```

Opens the private playground at `localhost:5173` with 5k / 25k / 100k synthetic 1m bars, a
crosshair OHLC readout, a theme toggle, an FPS meter, SMA/RSI/MACD toggles, drawing tools,
timeframe aggregation, local Binance and SPX snapshots, and a "Use feed" mode with a
simulated async feed. No live connection is required. Keyboard: arrows pan, `+`/`-`
zoom, `Home` fits. Pinch zoom works on touch. Core edits hot-reload.

## Packages

| Package                  | Status  | Description                                          |
| ------------------------ | ------- | ---------------------------------------------------- |
| `@wicklib/core`          | alpha   | Canvas2D scales, series, panes, indicators, drawings |
| `@wicklib/indicators`    | alpha   | Built-in indicator catalog                           |
| `@wicklib/react`         | alpha   | Thin React mount wrapper and `useChart`              |
| `@wicklib/script`        | alpha   | WickScript API v1, compiler, worker runtime          |
| `@wicklib/script-editor` | planned | Monaco integration                                   |
| `wicklib`                | alpha   | Umbrella package: core + indicators                  |

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

See `docs/rfc/` for the accepted public API, datafeed, indicator/pane, and drawing contracts,
`apps/playground/BENCHMARK.md` for the rendering baseline, and `packages/script/PLAN.md`
plus its ADRs for the scripting design that is frozen but not yet implemented.

## Releasing

Publishing is **manual** and publish-only: version locally, then run the `release` workflow
from the Actions tab.

npm trusted publishing is configured on every package, but GitHub issues immutable OIDC
subjects for repositories created after 2026-07-15 and npm does not support them yet
([npm/cli#9969](https://github.com/npm/cli/issues/9969)). Until that is fixed, releases
authenticate with a granular `NPM_TOKEN` repository secret and provenance is disabled. When
npm supports the new subject format, delete the secret, remove the token step, restore
`publishConfig.provenance`, and add `id-token: write`.

The alpha line uses the `next` tag. Enter prerelease mode once with
`pnpm changeset pre enter next`; exit with `pnpm changeset pre exit` before the first stable
release.

1. Add an `NPM_TOKEN` Actions secret with publish access to `@wicklib` and `wicklib`
   (90-day granular token; rotate it).
2. Add a changeset with `pnpm changeset`.
3. Version with `pnpm changeset version`.
4. Commit the version changes and push.
5. Run the `release` workflow manually. It only publishes; it does not version.

The initial `0.1.0-dev.0` versions were published manually. `latest` stays on them until a
stable release; install the alpha with `@next` or an exact version.

## License

Apache-2.0. See [LICENSE](./LICENSE).
