# Wicklib — Implementation Plan

Status: Phase 1 complete. Phase 2 not started.

Phase 1 froze the contract: packages, toolchain, CI, release pipeline, API report, extension
seams, and the normative WickScript plan. No rendering exists yet.

## Phase 2 — rendering vertical slice

Goal: a usable candlestick chart with real data, no indicators.

1. `Renderer` interface + Canvas2D implementation; layered surfaces (grid, series, overlays,
   crosshair, UI).
2. Data model: `Float64Array`-backed bars, time index, stable series identity.
3. Time scale: sessions, gaps, timezone display, DST. Start equity/forex aware.
4. Price scale: linear, log-ready, autoscale, padding, nice ticks.
5. Candlestick series through `addSeries`; axis rendering.
6. Interactions: crosshair, wheel zoom, drag pan, keyboard, touch.
7. `Datafeed` adapters: static array and HTTP range loader.
8. `destroy()` lifecycle with zero leaks; resize observer.
9. Performance baseline: 100k bars, 60fps pan/zoom on a mid-range laptop.

Exit criteria: a demo page renders 100k bars from an HTTP datafeed with crosshair,
zoom, pan, and correct teardown; no public API change against the Phase 1 report.

## Phase 3 — indicators and structure

1. `@wicklib/indicators` free catalog (SMA, EMA, RSI, MACD, Bollinger, VWAP, ATR).
2. `registerIndicator` with parameter schema and pane assignment.
3. Drawing tools: trendline, horizontal, rectangle, fib retracement, measure.
4. Multi-pane support and synced time scales.
5. `@wicklib/react` real wrapper plus `useChart`.
6. Visual regression suite (Playwright screenshots) and determinism fixtures.

## Phase 4 — WickScript

Follow `packages/script/PLAN.md` exactly. Accept ADR-0006 before writing the transpiler.
Ship the runtime, free `ta.*`, then the editor. No core API changes without an ADR.

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
