# @wicklib/core

Canvas2D charting engine: scales, candlestick rendering, axes, crosshair, and interactions.

**Status: Phase 2 vertical slice.** Candlestick charts render real data. Datafeed adapters
are not implemented yet; they are specified by RFC-0002.

```ts
import { CandlestickSeries, createChart } from "@wicklib/core";

const chart = createChart(document.getElementById("chart")!, { autoSize: true });
const series = chart.addSeries(CandlestickSeries, { title: "BTC/USD" });

series.setData([{ time: Date.UTC(2024, 0, 1), open: 100, high: 105, low: 95, close: 102 }]);
chart.timeScale().fitContent();
```

## What is implemented

- Continuous index-based time scale and linear price scale.
- Candlestick series with layered canvas rendering.
- Price and time axes, grid, last-value line and label, series legend.
- Crosshair (normal and magnet), click, pan, wheel zoom, resize, clean teardown.
- Typed errors, strict data validation, per-chart extensions snapshot.

## What is not

- Datafeed (RFC-0002), other series types, indicators, drawings, panes, sessions/DST.
- Logarithmic price scale (accepted option, throws `NOT_IMPLEMENTED`).

## Rules

- No runtime dependencies.
- Never imports sibling Wicklib packages. Extensions register inward.
- The public surface is gated by API Extractor; `etc/core.api.md` is reviewed like code.

## License

Apache-2.0.
