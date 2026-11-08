# @wicklib/core

## 0.18.0

### Minor Changes

- 359bb65: Add automatic Elliott label placement: labels center above local highs and below local lows,
  with forced `above`/`below` overrides. Labels flip inside the pane and respect custom sizes,
  boxless rendering, and label sequences.

## 0.17.0

### Minor Changes

- 8964dbc: Add `labelFontSize` and `labelBackgroundVisible` drawing options. Labels can use a custom size,
  and boxless labels skip the background and use their drawing-specific colour.

## 0.16.0

### Minor Changes

- 7555bd5: Add custom per-anchor label overrides for Elliott drawing tools. Label sequences persist with
  the drawing, while Elliott degree catalogs and UI remain host-owned.

## 0.15.0

### Minor Changes

- 01d9fe0: Add `lastValueMode` for visible, newest-data, or dual last-value labels, expose
  `SeriesApi.lastValue()` and `SeriesApi.visibleLastValue()`, and clamp off-screen current
  prices to the axis with direction markers.

## 0.14.0

### Minor Changes

- 5bf50bf: Add the full drawing-tool expansion: Stats Line, Ray, Extended Line, Trend Angle, Arrow,
  Regression Trend, Flat Top/Bottom, Disjoint Channel, Fib Channel, Fib Time Zone, Pitchfork,
  Schiff Pitchfork, Modified Schiff Pitchfork, Gann Fan, and Speed Lines. Stats Line now
  honours its configured color, and preview rendering guards incomplete measurement anchors.
  Raise the core size budget to 44 kB.

## 0.13.2

### Patch Changes

- 68b2269: Render synchronously after ResizeObserver-driven canvas resizes so cleared backing stores are
  never painted before the deferred repaint during continuous panel resizing.

## 0.13.1

### Patch Changes

- Preserve bar spacing and the right-edge layout anchor during realtime datafeed updates, so
  appends and revisions no longer lose positive right padding or shift existing bars while the
  view is panned away from the latest bar.

## 0.13.0

No changes in this release.

## 0.12.0

### Minor Changes

- Add the free `@wicklib/layouts` package for multi-chart grids, time-range synchronization,
  mirrored crosshair lines, active-chart tracking, and structural layout snapshots. Keep
  extension overlays alive when drawings are loaded. Remove `panes` and `layouts` from the
  core licensing tokens because both are free capabilities.

## 0.11.0

### Minor Changes

- e25793f: Add instrument-specific price formatting through `priceScale.priceFormat.precision` and
  `priceScale.priceFormat.minMove`. Price, time, pane, series, and indicator APIs now expose
  resolved options and datafeed identity for host-owned workspace persistence. Datafeeds can
  select `auto`, `fit`, or `preserve` initial views when loading or switching symbols.
  Logarithmic price scales now support transforms, auto-ranging, ticks, and formatting.

## 0.10.0

### Minor Changes

- 1d45854: Add an experimental hybrid WebGL2 renderer backend with Canvas2D fallback, keeping text, axes, annotations, drawings, overlays, and crosshair on Canvas2D.

## 0.9.0

### Minor Changes

- 52e1b1f: Add a drawing-double-click event for host-specific editing actions, and polish the playground settings panel with mixed-value states and text editing.

## 0.8.0

### Minor Changes

- 9f62d6b: Add keyboard drawing navigation, select-all, and a polite ARIA live announcement for drawing selection changes.

## 0.7.0

### Minor Changes

- 9654a80: Expose a stable drawing tool catalog with category grouping and per-tool settings capabilities for host-built menus.

## 0.6.0

### Minor Changes

- 422537c: Expose per-tool drawing settings metadata so hosts can show only relevant controls; the playground now hides text/font for Elliott waves and other inapplicable settings.

## 0.5.0

### Minor Changes

- 00ce9ff: Add drawing settings APIs for reading options, updating the selection, and per-tool defaults, and bound parallel channels to their anchor range instead of the full chart.

## 0.4.0

### Minor Changes

- d85cec7: Add brush, highlighter, path, and text drawing tools, and make the first Elliott wave anchor the labelled origin.

## 0.3.0

### Minor Changes

- 2cb74e5: Add Elliott impulse, correction, triangle, double-combo, and triple-combo drawing tools, and preview a parallel channel's base line before the third anchor.

## 0.2.0

### Minor Changes

- 3412efd: Add horizontal ray, vertical line, cross line, parallel channel, Fibonacci extension, long/short position, price/date range, and circle drawing tools, plus additive multi-selection, marquee selection, group move, and group delete.

## 0.1.0

### Minor Changes

- 4e5282c: Add time-axis drag zoom and automatically size the price axis from its rendered labels.
- b8b05d5: Add horizontal trackpad panning, price-axis scaling with manual vertical panning, double-click auto-scale reset, `PriceScaleApi.isAutoScale()`, and `ChartApi.resetView()`.
- 4fa4f08: Add a typed chart theme contract with neutral light and dark presets for host-controlled theme application.
- ea119c7: Add public per-pane Canvas2D chart overlays with typed geometry, lifecycle, and pane cascade.
- 3b5baf1: Add generic line-series storage and working line, area, and histogram series types with datafeeds, markers, price lines, and auto-scaling.
- 4f639a3: Add a lightweight-charts option mapper plus explicit wheel, drag, pinch, axis, and time-axis border controls.
- fd8cb35: Add `timeScale.maxVisibleBars` to cap how many bars can be visible when zooming out.
- 0ecfbf1: Add keyboard pan/zoom/fit controls and two-pointer pinch zoom.
- e76e9e7: Add `titlePosition` to price lines so titles can render inside the plot while the price-axis label retains the value.
- f2219e7: Add series datafeed
- 489496a: Add multi-pane charts, the indicator engine, and built-in SMA, EMA, RSI, MACD, Bollinger Bands, VWAP, and ATR. Add optional OHLC volume for VWAP. Add trend line, horizontal line, rectangle, Fibonacci retracement, and measure drawings with selection, editing, and versioned documents.
- 9979430: Add series price lines, replaceable series markers, and composited chart screenshot/data-URL export.
- 54eb258: Add host-supplied trading calendars. Session-aware time-axis labels now skip closed periods and include session opens and closes across DST transitions.
- 93cf6b0: Add explicit session gaps with `timeScale.gapMode: "show"` and `gapWidth`, including gap-aware pan, zoom, fitting, drawings, and aggregated candle rendering.

### Patch Changes

- 1ae98ba: Allow clearing a chart trading calendar with `timeScale.setOptions({ calendar: null })` and prefer session-open labels when compressed session boundaries collide.
- 36abc29: Focus the chart on pointer down so keyboard drawing deletion works after selecting a drawing.
- ad75744: Place drawing anchors at the pointer position instead of snapping the price to the crosshair magnet.
- 4e01fc6: Allow time coordinates, time-axis labels, and drawings to extend beyond the last bar using the last observed interval.
- c41b1ce: Prevent aggregated candles from merging across session gaps, which produced tall boundary candles.
- b0dae75: Fix sparse lightweight-charts option mapping and reapply auto-scale after an automatic axis-width relayout.
- b9e2ea5: Avoid duplicate month labels when a chart shows several months of data by aligning wide time-axis ticks to calendar month boundaries.

## 0.1.0-next.32

### Patch Changes

- 36abc29: Focus the chart on pointer down so keyboard drawing deletion works after selecting a drawing.

## 0.1.0-next.31

No changes in this release.

## 0.1.0-next.30

No changes in this release.

## 0.1.0-next.29

### Minor Changes

- 3b5baf1: Add generic line-series storage and working line, area, and histogram series types with datafeeds, markers, price lines, and auto-scaling.

## 0.1.0-next.28

### Patch Changes

- b0dae75: Fix sparse lightweight-charts option mapping and reapply auto-scale after an automatic axis-width relayout.

## 0.1.0-next.27

### Minor Changes

- 4fa4f08: Add a typed chart theme contract with neutral light and dark presets for host-controlled theme application.

## 0.1.0-next.26

### Minor Changes

- 4e5282c: Add time-axis drag zoom and automatically size the price axis from its rendered labels.

## 0.1.0-next.25

### Minor Changes

- e76e9e7: Add `titlePosition` to price lines so titles can render inside the plot while the price-axis label retains the value.

## 0.1.0-next.24

### Minor Changes

- 4f639a3: Add a lightweight-charts option mapper plus explicit wheel, drag, pinch, axis, and time-axis border controls.

## 0.1.0-next.23

### Minor Changes

- ea119c7: Add public per-pane Canvas2D chart overlays with typed geometry, lifecycle, and pane cascade.
- 9979430: Add series price lines, replaceable series markers, and composited chart screenshot/data-URL export.

## 0.1.0-next.22

No changes in this release.

## 0.1.0-next.21

No changes in this release.

## 0.1.0-next.20

No changes in this release.

## 0.1.0-next.19

No changes in this release.

## 0.1.0-next.18

No changes in this release.

## 0.1.0-next.17

No changes in this release.

## 0.1.0-next.16

No changes in this release.

## 0.1.0-next.15

No changes in this release.

## 0.1.0-next.14

No changes in this release.

## 0.1.0-next.13

No changes in this release.

## 0.1.0-next.12

### Patch Changes

- c41b1ce: Prevent aggregated candles from merging across session gaps, which produced tall boundary candles.

## 0.1.0-next.11

### Minor Changes

- 93cf6b0: Add explicit session gaps with `timeScale.gapMode: "show"` and `gapWidth`, including gap-aware pan, zoom, fitting, drawings, and aggregated candle rendering.

## 0.1.0-next.10

### Patch Changes

- 1ae98ba: Allow clearing a chart trading calendar with `timeScale.setOptions({ calendar: null })` and prefer session-open labels when compressed session boundaries collide.

## 0.1.0-next.9

### Minor Changes

- 54eb258: Add host-supplied trading calendars. Session-aware time-axis labels now skip closed periods and include session opens and closes across DST transitions.

## 0.1.0-next.8

### Patch Changes

- 4e01fc6: Allow time coordinates, time-axis labels, and drawings to extend beyond the last bar using the last observed interval.

## 0.1.0-next.7

### Patch Changes

- ad75744: Place drawing anchors at the pointer position instead of snapping the price to the crosshair magnet.

## 0.1.0-next.6

### Minor Changes

- b8b05d5: Add horizontal trackpad panning, price-axis scaling with manual vertical panning, double-click auto-scale reset, `PriceScaleApi.isAutoScale()`, and `ChartApi.resetView()`.

## 0.1.0-next.5

### Minor Changes

- fd8cb35: Add `timeScale.maxVisibleBars` to cap how many bars can be visible when zooming out.

## 0.1.0-next.4

### Patch Changes

- b9e2ea5: Avoid duplicate month labels when a chart shows several months of data by aligning wide time-axis ticks to calendar month boundaries.

## 0.1.0-next.3

### Minor Changes

- 489496a: Add multi-pane charts, the indicator engine, and built-in SMA, EMA, RSI, MACD, Bollinger Bands, VWAP, and ATR. Add optional OHLC volume for VWAP. Add trend line, horizontal line, rectangle, Fibonacci retracement, and measure drawings with selection, editing, and versioned documents.

## 0.1.0-next.2

### Minor Changes

- Add keyboard pan/zoom/fit controls and two-pointer pinch zoom.

## 0.1.0-next.1

### Minor Changes

- Add series datafeed
