# @wicklib/core

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
