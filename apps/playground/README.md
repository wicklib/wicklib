# Playground

Private local dev harness for `@wicklib/core`.

```sh
pnpm dev        # from the repo root
```

Vite aliases `@wicklib/core` to `packages/core/src/index.ts`, so edits hot-reload without
a rebuild. The published package and the site still resolve through `dist`.

Never published. Not part of the Changesets group.

## Controls

- Dataset size: 5k, 25k, 100k synthetic 1m bars.
- Regenerate: new deterministic dataset (seed increments).
- Use feed: simulated async feed with latency, live bars, loading state, and range loads.
- Fit: reset the time scale.
- Theme: dark/light chart options.
- FPS meter and crosshair OHLC readout.
- Keyboard: arrows pan, `+`/`-` zoom, `Home` fits, `Escape` clears the crosshair.
- Touch: one-finger pan, two-finger pinch zoom.

## URL modes

- `?feed` — start in datafeed mode.
- `?test` — deterministic static chart, animation/FPS loop disabled, sets
  `window.__wicklibReady` for Playwright.
- `?bench` — runs a 180-frame 100k-bar pan benchmark and exposes `window.__wicklibBench`.

## Visual tests

```sh
pnpm --filter @wicklib/playground exec playwright install chromium   # once
pnpm test:visual
```

The suite captures a text-free plot crop for visual regression and asserts the 100k-bar pan
benchmark stays under the CI threshold. The recorded baseline is in
[BENCHMARK.md](./BENCHMARK.md).

To regenerate the snapshot after an intentional rendering change:

```sh
pnpm --filter @wicklib/playground test:visual:update
```
