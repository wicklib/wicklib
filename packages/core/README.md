# @wicklib/core

Canvas2D charting engine: scales, candlestick rendering, axes, crosshair, and interactions.

**Status: Phase 3 — indicators and panes.** Candlestick charts render real data, can be
driven by an async series-level datafeed, and support multiple panes and indicators.

```ts
import { CandlestickSeries, createChart, type Datafeed, type OhlcData } from "@wicklib/core";
import { SMA } from "@wicklib/indicators";

// A host-provided feed; see docs/rfc/0002-datafeed.md for the full contract.
declare const feed: Datafeed<OhlcData>;

const chart = createChart(document.getElementById("chart")!, { autoSize: true });
const series = chart.addSeries(CandlestickSeries, { title: "BTC/USD" });

series.setData([{ time: Date.UTC(2024, 0, 1), open: 100, high: 105, low: 95, close: 102 }]);
chart.timeScale().fitContent();

// Or let a datafeed drive the series:
series.setDatafeed(feed, { symbol: "BTC/USD", interval: "1m", initialBars: 500 });
chart.on("data-loading", ({ loading }) => console.log("loading", loading));

// Indicators come from the companion package:
chart.addIndicator(SMA, { inputs: { period: 50, source: "close" } });
```

## What is implemented

- Continuous index-based time scale and linear price scale.
- Candlestick series with layered canvas rendering.
- Price and time axes, grid, last-value line and label, series legend.
- Crosshair (normal and magnet), click, drag pan, wheel zoom, resize, clean teardown.
- Keyboard pan/zoom/fit, and two-pointer pinch zoom on touch devices.
- Series datafeed: initial count load, debounced range loads with prefetch, abort on stale
  requests, prepend anchoring, realtime revision, loading and error events.
- Panes with independent price scales and a shared time axis.
- Indicator engine: typed inputs, pure compute, coalesced recompute, line/histogram/area plots.
- Optional OHLC volume, used by VWAP.
- Typed errors, strict data validation, per-chart extensions snapshot.

## What is not

- Drawings, standalone line/area/histogram series, WickScript, sessions/DST.
- Logarithmic price scale (accepted option, throws `NOT_IMPLEMENTED`).

## Rules

- No runtime dependencies.
- Never imports sibling Wicklib packages. Extensions register inward.
- The public surface is gated by API Extractor; `etc/core.api.md` is reviewed like code.

## License

Apache-2.0.
