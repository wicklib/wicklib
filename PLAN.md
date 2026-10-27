# Wicklib — Implementation Plan

Status: Phase 1 complete. Phase 2 complete. Phase 3 complete. Phase 4 in progress:
ADR-0006 accepted; WickScript authoring, compiler, QuickJS worker runtime, replay/stream,
golden/fuzz tests, initial `ta.*`, and Monaco editor are implemented.

Phase 1 froze the contract: packages, toolchain, CI, release pipeline, API report, extension
seams, and the normative WickScript plan. No rendering exists yet.

## Phase 2 — rendering vertical slice

Status: complete. Steps 0–7 implemented.

Decisions:

- Continuous time first (crypto/forex). No sessions, holidays, or DST yet; session logic is
  deferred behind a time-scale policy seam.
- The dev harness is a private playground in this repo. The site is never used as a dev loop.
- The Phase 1 types are placeholders. Replacing them is expected and must be a reviewed API
  report diff, not an accident.

Goal: a usable candlestick chart with real data, no indicators.

### Step 0 — API design pass (done)

RFC-0001 is accepted. The types and API report were updated from it.

- series definition, options, and data attachment;
- chart lifecycle, subscription, and event payloads;
- error model and typed error codes;
- how extensions, license metadata, and multiple charts fit together;
- datafeed deferred to RFC-0002.

### Step 0.5 — playground (done)

`apps/playground`: private Vite + vanilla TypeScript app wired to the workspace.

- `pnpm dev` from the repo root.
- Synthetic OHLC generator, bar-count and theme controls, FPS counter.
- Never published, never part of the Changesets group.
- Playwright visual regression and a 100k-bar pan benchmark run against it.

### Step 1 — data and scales (done)

- `Float64Array`-backed bars, stable series identity, immutable snapshots.
- Continuous time scale: index ↔ time, gaps handled by the policy seam later.
- Price scale: linear, log-ready, autoscale, padding, nice ticks.
- Pure functions, no DOM, fully unit-tested.

### Step 2 — renderer (done)

- `Renderer` interface and Canvas2D implementation.
- Layered surfaces: grid, series, overlays, crosshair, UI.
- Device-pixel-ratio handling; offscreen canvas where it pays.

### Step 3 — lifecycle (done)

- Container mount, `ResizeObserver`, visibility handling, `destroy()` with zero leaks.
- No global state; multiple charts on one page must be independent.

### Step 4 — candlestick vertical slice (done)

- Candlestick series through the real series pipeline.
- Price axis and time axis with correct tick selection.
- Empty state is built in. Loading and error states are emitted as events and rendered by
  the host; the engine draws no spinner by design.

### Step 5 — interactions (done)

- Crosshair with snapping and a shared event payload.
- Wheel zoom anchored at the pointer; drag pan.
- Keyboard: arrows pan, `+`/`-` zoom, `Home` fits, `Escape` clears the crosshair.
- Touch: single-pointer pan and two-pointer pinch zoom.
- Spacing and right offset clamp to keep data reachable. Panning stops on release; there is
  no inertia in Phase 2.

### Step 6 — datafeed (done)

RFC-0002 accepted and implemented.

- Series-level `setDatafeed`, `clearDatafeed`, `isLoading`.
- Initial count load, debounced range loads, 50% prefetch, abort on stale requests.
- Merge with prepend anchoring and realtime revision semantics.
- `data-loading` events; datafeed errors on the `error` event with `seriesId`.
- Mock async feed in the playground.

### Step 7 — performance and regression (done)

- 100k bars, continuous pan baseline: median 16.7 ms, p95 16.7 ms, 59.9 fps on an Apple M2.
- Playwright visual regression snapshot of a text-free plot crop.
- Deterministic synthetic dataset (fixed seed) and benchmark mode.
- See `apps/playground/BENCHMARK.md`.

Exit criteria:

- [x] Playground renders 100k synthetic bars with crosshair, zoom, pan, and clean teardown.
- [x] 60fps interaction baseline recorded.
- [x] API report diff reviewed and documented.
- [x] Unit tests for scales, store merging, datafeed, and lifecycle.
- [x] Visual tests for rendering.
- [x] No sessions/DST, no WebGL, no indicators, no script, no pro in this phase.

Implemented in this phase: continuous time scale, linear price scale, layered Canvas2D
renderer, candlestick series, price/time axes, grid, legend, last-value line, crosshair
(normal and magnet), click events, drag pan, wheel zoom, resize, dispose, strict validation,
typed errors, per-chart extension validation, the series datafeed, keyboard and pinch
interactions, visual regression, the performance baseline, and the private playground.

## Phase 3 — indicators and panes

Status: complete. RFC-0003 and RFC-0004 accepted; indicators, panes, drawings, and the React
wrapper implemented.

1. [done] `@wicklib/indicators` free catalog: SMA, EMA, RSI, MACD, Bollinger Bands, VWAP, ATR.
2. [done] `chart.addIndicator` with typed inputs, plot definitions, and pane assignment.
3. [done] Drawing tools: trendline, horizontal, rectangle, fib retracement, measure.
4. [done] Multi-pane support: per-pane price scales, shared time axis, pane crosshair.
5. [done] `@wicklib/react` real wrapper plus `useChart`.
6. [done] Visual regression with indicator panes and a 7-indicator benchmark.

Implementation notes: `OhlcData` now carries optional volume for VWAP; indicator plots use
the internal line/histogram/area renderers; standalone line/area/histogram series remain
deferred until a generic data store exists. The React wrapper is client-only: `WickChart`
creates the core chart in an effect, patches option updates, recreates on extension changes,
and exposes the chart through `useChart`. Sessions/DST remain deferred behind the time-scale
policy seam. RFC-0005 is accepted; compressed session labels, DST resolution, and explicit
closed-period gaps are implemented. Real exchange data is a playground-only static snapshot:
the Binance importer validates and compacts monthly Binance ZIPs; no live feed or core datafeed
changes are involved.

## Phase 4 — WickScript

Status: in progress. ADR-0006 accepted. API v1 authoring, compiler validation, QuickJS worker
runtime, strict streaming semantics, initial `ta.*`, golden/fuzz tests, and the Monaco editor
are implemented. Broader `ta.*` coverage and the pro script layer remain.

Follow `packages/script/PLAN.md` exactly. No core API changes without an ADR.

## Phase 5 — performance

1. WebGL2 backend behind the existing `Renderer` interface.
2. Data decimation for extreme zoom-out.
3. Worker-based indicator computation.
4. Memory profiling and bundle budgets.

## Release and API policy

- 0.x until the public surface stops moving; semver from 1.0.
- API Extractor report is reviewed in every PR.
- All free packages release together as one fixed Changesets group.
- Deprecations last one minor cycle, removals require a major.

## Non-goals

No trading backend, no accounts, no persistence, no data vendor, no server-side rendering
of charts. Those are host application concerns.
