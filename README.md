# Wicklib

Open-source charting engine for web applications. Canvas-first, framework-agnostic, and
designed for a clean separation between the free engine and the commercial add-on.

**Status: 0.1.0.** The free core is feature-complete for the initial stable release:
candlestick/line/area/histogram series, panes, indicators, drawings, annotations, themes,
export, session-aware axes, and WickScript with a documented `ta.*` set and Monaco editor.
The public API remains 0.x until it stabilizes for 1.0.

## Try it

```sh
pnpm install
pnpm dev
```

Opens the private playground at `localhost:5173` with 5k / 25k / 100k synthetic 1m bars, a
crosshair OHLC readout, a theme toggle, an FPS meter, SMA/RSI/MACD toggles, drawing tools,
timeframe aggregation, local Binance and SPX snapshots, a Monaco script editor at
`/editor.html`, a line/area/histogram and annotation demo at `/series.html`, and a "Use feed"
mode with a simulated async feed. No live connection is
required. Keyboard: arrows pan, `+`/`-` zoom, `Home` fits, `Delete`/`Backspace` removes the
selected drawing. Pinch zoom works on touch. Core edits hot-reload.

## Packages

| Package                  | Status | Description                                                                                                       |
| ------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------- |
| `@wicklib/core`          | 0.1.0  | Canvas2D scales, candlestick/line/area/histogram series, panes, indicators, drawings, annotations, export, themes |
| `@wicklib/indicators`    | 0.1.0  | Built-in indicator catalog                                                                                        |
| `@wicklib/react`         | 0.1.0  | Thin React mount wrapper and `useChart`                                                                           |
| `@wicklib/script`        | 0.1.0  | WickScript API v1, compiler, worker runtime                                                                       |
| `@wicklib/script-editor` | 0.1.0  | Monaco editor with generated WickScript types                                                                     |
| `wicklib`                | 0.1.0  | Umbrella package: core + indicators                                                                               |

The commercial add-on (`@wicklib/pro`) lives in a separate private repository and consumes
`@wicklib/core` through its published entrypoint only.

## Documentation

- [Documentation index](./docs/README.md)
- [Core API and examples](./packages/core/README.md)
- [RFCs](./docs/rfc/README.md) and [release procedure](./docs/RELEASE.md)
- [Playground guide](./apps/playground/README.md) and [benchmark](./apps/playground/BENCHMARK.md)
- [WickScript plan](./packages/script/PLAN.md) and [script guide](./packages/script/README.md)

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

See `docs/README.md` for the documentation index, `docs/rfc/` for accepted contracts,
`apps/playground/BENCHMARK.md` for the rendering baseline, and `packages/script/PLAN.md`
plus its ADRs for the scripting design.

## Releasing

Publishing is **manual** and publish-only: version locally, then run the `release` workflow
from the Actions tab.

npm trusted publishing is configured on every package, but GitHub issues immutable OIDC
subjects for repositories created after 2026-07-15 and npm does not support them yet
([npm/cli#9969](https://github.com/npm/cli/issues/9969)). Until that is fixed, releases
authenticate with a granular `NPM_TOKEN` repository secret and provenance is disabled. When
npm supports the new subject format, delete the secret, remove the token step, restore
`publishConfig.provenance`, and add `id-token: write`.

The stable line uses the default `latest` tag. Prereleases use `next`; graduate a line with
`pnpm changeset pre exit` and a final versioning pass. See
[docs/RELEASE.md](./docs/RELEASE.md) for the full checklist.

1. Add an `NPM_TOKEN` Actions secret with publish access to `@wicklib` and `wicklib`
   (90-day granular token; rotate it).
2. Add a changeset with `pnpm changeset`.
3. Version with `pnpm changeset version`.
4. Commit the version changes and push.
5. Run the `release` workflow manually. It only publishes; it does not version.

The initial `0.1.0-dev.0` versions were published manually. `0.1.0` is the first stable
latest release; prerelease builds use `@next` or an exact version.

## License

Apache-2.0. See [LICENSE](./LICENSE).
