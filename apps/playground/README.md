# Playground

Private local dev harness for `@wicklib/core`.

```sh
pnpm dev        # from the repo root
```

Vite aliases `@wicklib/core` to `packages/core/src/index.ts`, so edits hot-reload without
a rebuild. The published package and the site still resolve through `dist`.

Never published. Not part of the Changesets group.

## Controls

- Dataset size: 5k, 25k, 100k synthetic 1m bars. Zooming out is capped at 720 bars.
- Timeframe: 1m, 5m, 15m, 1h, 4h, or 1d, aggregated from the selected 1m source.
- Regenerate: new deterministic dataset (seed increments).
- Use feed: simulated async feed with latency, live bars, loading state, and range loads.
- Binance 2025: load the local one-year BTCUSDT 1m snapshot (525,600 bars).
- SPX 5m: load a local one-month Yahoo ^GSPC snapshot.
- Sessions: a deterministic US equities regular-hours fixture with a DST-aware calendar.
- SMA / RSI / MACD toggles: overlays and separate indicator panes.
- Trend, H-Line, Rect, Fib, and Clear: interactive drawing tools.
- Fit: reset the time scale, capped at 720 bars.
- Reset: fit the time scale and restore auto-scale on every pane.
- Fit/reset leave a 30-bar future margin so drawings and dates can extend past the last bar.
- Price axis: drag vertically to scale the price range and leave auto-scale; double-click to
  restore auto-scale. While manual, chart dragging pans both horizontally and vertically.
- Trackpad: horizontal swipe pans time; vertical scroll or pinch zooms.
- Theme: dark/light chart options.
- FPS meter and crosshair OHLC readout.
- Keyboard: arrows pan, `+`/`-` zoom, `Home` fits, `Escape` clears the crosshair.
- Touch: one-finger pan, two-finger pinch zoom.
- Script editor: open `/editor.html` for the Monaco WickScript editor with generated types.

## Script editor

Open `/editor.html` during development or preview. It mounts Monaco with generated Wicklib
authoring types and the TypeScript worker. This is the browser smoke test for
`@wicklib/script-editor`.

## URL modes

- `?feed` — start in datafeed mode.
- `?binance` — load the local Binance 2025 BTCUSDT 1m snapshot.
- `?spx` — load the local Yahoo ^GSPC one-month 5m snapshot.
- `?sessions` — load the US equities regular-hours fixture and session calendar.
- `?timeframe=15m` — start on a derived timeframe; accepts `1m`, `5m`, `15m`, `1h`, `4h`, `1d`.
- `?indicators` — enable SMA, RSI, and MACD.
- `?drawings` — add a deterministic set of demo drawings.
- `?test` — deterministic static chart, animation/FPS loop disabled, sets
  `window.__wicklibReady` for Playwright.
- `?bench` — runs a 180-frame 100k-bar pan benchmark and exposes `window.__wicklibBench`.

## Session fixture

`?sessions` generates two deterministic US equities regular-hours sessions. The chart uses
`America/New_York`, Monday–Friday 09:30–16:00, a 24px closed-session gap, and session-aware
labels without requiring external data. The fixture is synthetic and private to the
playground.

## SPX snapshot

The SPX mode downloads Yahoo Finance chart data into the same local, gitignored data folder:

```sh
pnpm --filter @wicklib/playground data:yahoo
```

The default is `^GSPC`, `5m`, `1mo`, with pre/post-market rows excluded. Yahoo only exposes
about seven days of 1m index data, so the one-month sample uses 5m bars. Optional arguments
are `--symbol`, `--interval`, `--range`, and `--output`.

Output: `apps/playground/public/data/yahoo-gspc-5m-1mo.json`

The chart uses `gapMode: "show"` with an 8px closed-session gap and the US equities calendar.
Use the wheel or Fit/Reset to move between a session-level view and the broader month. Yahoo data is delayed and rounded;
use it for visual/layout validation, not backtesting.

## Binance snapshot

The playground can load a static Binance USD-M futures snapshot. It is not a live feed and
does not use the datafeed contract.

1. Download the 12 monthly BTCUSDT 1m ZIPs for 2025 from
   [Binance Data Collection](https://data.binance.vision/?prefix=data/futures/um/monthly/klines/BTCUSDT/1m/)
   into `~/Downloads`.
2. Generate the local snapshot:

```sh
pnpm --filter @wicklib/playground data:binance
```

The importer validates ascending times and OHLC, then writes:

`apps/playground/public/data/binance-btcusdt-1m-2025.json`

That file is generated and gitignored. The loader maps the compact bar arrays to `OhlcData`
and calls `series.setData()`. No live feed, polling, WebSocket, or range loading is involved.

Optional importer arguments are `--input`, `--symbol`, `--interval`, `--year`, and `--output`.

## Visual tests

```sh
pnpm --filter @wicklib/playground exec playwright install chromium   # once
pnpm test:visual
```

The suite captures text-free plot crops for the static chart, indicator panes, and drawing
tools, verifies derived timeframe aggregation, and asserts the 100k-bar pan benchmark stays
under the CI threshold with all seven built-in indicators loaded. The recorded baseline is in
[BENCHMARK.md](./BENCHMARK.md).

To regenerate the snapshot after an intentional rendering change:

```sh
pnpm --filter @wicklib/playground test:visual:update
```
