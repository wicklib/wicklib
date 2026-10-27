# @wicklib/core

Canvas2D charting engine: scales, candlestick rendering, axes, crosshair, and interactions.

**Status: Phase 2 vertical slice + datafeed.** Candlestick charts render real data and can
be driven by an async series-level datafeed.

```ts
import { CandlestickSeries, createChart, type Datafeed, type OhlcData } from "@wicklib/core";

// A host-provided feed; see docs/rfc/0002-datafeed.md for the full contract.
declare const feed: Datafeed<OhlcData>;

const chart = createChart(document.getElementById("chart")!, { autoSize: true });
const series = chart.addSeries(CandlestickSeries, { title: "BTC/USD" });

series.setData([{ time: Date.UTC(2024, 0, 1), open: 100, high: 105, low: 95, close: 102 }]);
chart.timeScale().fitContent();

// Or let a datafeed drive the series:
series.setDatafeed(feed, { symbol: "BTC/USD", interval: "1m", initialBars: 500 });
chart.on("data-loading", ({ loading }) => console.log("loading", loading));
```

## What is implemented

- Continuous index-based time scale and linear price scale.
- Candlestick series with layered canvas rendering.
- Price and time axes, grid, last-value line and label, series legend.
- Crosshair (normal and magnet), click, pan, wheel zoom, resize, clean teardown.
- Series datafeed: initial count load, debounced range loads with prefetch, abort on stale
  requests, prepend anchoring, realtime revision, loading and error events.
- Typed errors, strict data validation, per-chart extensions snapshot.

## What is not

- Other series types, indicators, drawings, panes, sessions/DST.
- Logarithmic price scale (accepted option, throws `NOT_IMPLEMENTED`).

## Rules

- No runtime dependencies.
- Never imports sibling Wicklib packages. Extensions register inward.
- The public surface is gated by API Extractor; `etc/core.api.md` is reviewed like code.

## License

Apache-2.0.
