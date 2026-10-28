# @wicklib/core

Canvas2D charting engine: scales, series, axes, crosshair, interactions, panes, indicators,
drawings, annotations, themes, and export.

**Status: pre-1.0.** The free core feature set is implemented and published on the `next`
tag while the public API is stabilized.

```sh
pnpm add @wicklib/core@next
```

## Quick start

```ts
import { CandlestickSeries, createChart, type OhlcData } from "@wicklib/core";

const chart = createChart(document.getElementById("chart")!, {
  autoSize: true,
  timeScale: { maxVisibleBars: 720 },
});

const series = chart.addSeries(CandlestickSeries, {
  title: "BTC/USD",
  upColor: "#26a69a",
  downColor: "#ef5350",
});

series.setData([
  {
    time: Date.UTC(2024, 0, 1),
    open: 100,
    high: 105,
    low: 95,
    close: 102,
  } satisfies OhlcData,
]);
chart.timeScale().fitContent();
```

Times are non-negative integer milliseconds since the Unix epoch.

## Series types

```ts
import { AreaSeries, HistogramSeries, LineSeries } from "@wicklib/core";

const line = chart.addSeries(LineSeries, { color: "#2962ff", lineWidth: 2 });
const area = chart.addSeries(AreaSeries, { topColor: "rgba(41,98,255,0.4)" });
const histogram = chart.addSeries(HistogramSeries, { base: 0 });

line.setData([
  { time: 0, value: 100 },
  { time: 60_000, value: 104 },
]);
area.setData([
  { time: 0, value: 90 },
  { time: 60_000, value: 96 },
]);
histogram.setData([
  { time: 0, value: 4 },
  { time: 60_000, value: -2 },
]);
```

Indicators currently require a candlestick source series. Custom series renderers are not
part of the public API.

## Annotations

Price lines can place their title in the plot while keeping the price on the axis:

```ts
const line = series.createPriceLine({
  price: 105,
  color: "#10b981",
  lineStyle: "dashed",
  title: "Entry",
  titlePosition: "plot",
});

line.applyOptions({ price: 106 });
line.remove();

series.setMarkers([
  { time: 60_000, position: "belowBar", shape: "arrowUp", color: "#10b981", text: "Buy" },
]);
```

Markers are replaced as a complete set. Pass an empty array to clear them.

## Themes

Neutral presets can be applied at creation or switched without recreating the chart:

```ts
import { DarkTheme, LightTheme, createChart } from "@wicklib/core";

const chart = createChart(container, { ...DarkTheme });
chart.setOptions(LightTheme);
```

Themes cover chart chrome only. Series, candle, drawing, and indicator colors remain explicit
options. Core never reads CSS variables or `prefers-color-scheme`.

## Datafeeds

A series can be driven by a host-provided async feed:

```ts
series.setDatafeed(feed, {
  symbol: "BTC/USD",
  interval: "1m",
  initialBars: 500,
});

chart.on("data-loading", ({ loading }) => console.log("loading", loading));
```

The feed owns transport, authentication, retries, and reconnection. Core handles initial
loads, debounced range loads, prefetch, aborting stale requests, prepend anchoring, realtime
revisions, and typed loading/error events.

## Interaction and layout

- Continuous index-based time scale and linear price scale.
- Time-axis drag zooms; price-axis drag scales the price range.
- Wheel zoom, trackpad pan, drag pan, and two-pointer pinch zoom.
- Keyboard pan/zoom/fit and `Delete`/`Backspace` for selected drawings.
- Automatic price-axis width from rendered labels.
- Multi-pane layouts with independent price scales and a shared time axis.
- Session calendars, DST, holidays, and optional fixed-width closed-session gaps.
- Extension overlays clipped to panes with time/price coordinate helpers.

Use `interaction` to disable wheel, drag, pinch, or axis handling. Use `resetView()` to fit the
time scale and restore auto-scale on every pane.

## Screenshots

```ts
const canvas = chart.takeScreenshot();
const png = chart.exportImage("image/png");
```

Screenshots flush pending rendering and composite every canvas layer at backing-store
resolution.

## lightweight-charts migration

```ts
import { createChart, mapLightweightChartOptions } from "@wicklib/core";

const chart = createChart(container, mapLightweightChartOptions(lightweightOptions));
```

The mapper covers the supported layout, grid, crosshair, price-scale, time-scale, locale,
and interaction subset. Unsupported price modes fail with `NOT_IMPLEMENTED`; unknown fields
are ignored.

## Extensions and licensing

- Public per-pane overlay API with stable ids and pane cascade.
- Per-chart extension snapshot; duplicate ids are rejected.
- Host-owned licensing; core does not inspect paid entitlements.
- Commercial analytics live in the separate `@wicklib/pro` package.

## What is not included

- Host persistence, accounts, data vendors, or server-side rendering.
- Custom series renderers, multiple price axes, or indicator input over line series.
- Logarithmic price scale (accepted option, currently throws).
- WebGL rendering.

## Rules

- No runtime dependencies.
- Never imports sibling Wicklib packages.
- The public surface is gated by API Extractor; `etc/core.api.md` is reviewed like code.
- All free packages share one fixed release train.

See the repository `docs/` directory for RFCs, the playground, benchmarks, and release
procedures.

## License

Apache-2.0.
