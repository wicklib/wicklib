# @wicklib/core

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
