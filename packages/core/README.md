# @wicklib/core

Canvas2D charting engine: scales, candlestick rendering, axes, crosshair, interactions,
indicators, panes, and drawings.

**Status: Phase 3 complete.** Candlestick charts render real data, can be driven by an async
series-level datafeed, and support multiple panes, indicators, drawing tools, and a React
wrapper.

```ts
import {
  CandlestickSeries,
  createChart,
  TrendLine,
  type Datafeed,
  type OhlcData,
} from "@wicklib/core";
import { SMA } from "@wicklib/indicators";

// A host-provided feed; see docs/rfc/0002-datafeed.md for the full contract.
declare const feed: Datafeed<OhlcData>;

const chart = createChart(document.getElementById("chart")!, {
  autoSize: true,
  timeScale: {
    maxVisibleBars: 720,
    calendar: {
      timezone: "America/New_York",
      sessions: [1, 2, 3, 4, 5].map((day) => ({
        openDay: day,
        openTime: "09:30",
        closeDay: day,
        closeTime: "16:00",
      })),
      gapMode: "show",
      gapWidth: 12,
    },
  },
});
const series = chart.addSeries(CandlestickSeries, { title: "BTC/USD" });

series.setData([{ time: Date.UTC(2024, 0, 1), open: 100, high: 105, low: 95, close: 102 }]);
chart.timeScale().fitContent();

// Or let a datafeed drive the series:
series.setDatafeed(feed, { symbol: "BTC/USD", interval: "1m", initialBars: 500 });
chart.on("data-loading", ({ loading }) => console.log("loading", loading));

// Indicators come from the companion package:
chart.addIndicator(SMA, { inputs: { period: 50, source: "close" } });

// Drawings use data-space anchors; the host owns persistence.
chart.addDrawing(TrendLine, {
  anchors: [
    { time: Date.UTC(2024, 0, 1), price: 100 },
    { time: Date.UTC(2024, 0, 2), price: 108 },
  ],
});
chart.startDrawing(TrendLine); // or let the user place the anchors
const document = chart.serializeDrawings();
chart.loadDrawings(document);
```

## What is implemented

- Continuous index-based time scale and linear price scale, with optional zoom-out limits.
- Candlestick series with layered canvas rendering.
- Price and time axes, grid, last-value line and label, series legend.
- Crosshair (normal and magnet), click, drag pan, wheel zoom, horizontal trackpad pan, resize,
  clean teardown.
- Draggable price axis that scales the price range; manual mode then allows vertical chart
  panning. Double-click the axis to restore auto-scale, or call `chart.resetView()`.
- Time-axis labels and drawings can extend into empty space after the last bar, using the last
  observed interval.
- Host-supplied trading calendars with IANA time zones, DST-correct session boundaries,
  holidays, session-aware intraday labels, and optional fixed-width session gaps.
- Public per-pane Canvas2D extension overlays with pane-clipped time/price coordinate helpers.
- Keyboard pan/zoom/fit, and two-pointer pinch zoom on touch devices.
- Series datafeed: initial count load, debounced range loads with prefetch, abort on stale
  requests, prepend anchoring, realtime revision, loading and error events.
- Panes with independent price scales and a shared time axis.
- Indicator engine: typed inputs, pure compute, coalesced recompute, line/histogram/area plots.
- Drawing tools: trend line, horizontal line, rectangle, Fibonacci retracement, measure.
- Versioned drawing documents, selection, movement, anchor editing, and pane cascade.
- Optional OHLC volume, used by VWAP.
- Typed errors, strict data validation, per-chart extensions snapshot.

## What is not

- Host persistence and undo/redo for drawings, custom drawing renderers.
- Standalone line/area/histogram series, WickScript, sessions/DST.
- Logarithmic price scale (accepted option, throws `NOT_IMPLEMENTED`).

## Rules

- No runtime dependencies.
- Never imports sibling Wicklib packages. Extensions register inward.
- The public surface is gated by API Extractor; `etc/core.api.md` is reviewed like code.

## License

Apache-2.0.
