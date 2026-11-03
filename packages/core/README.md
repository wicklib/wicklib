# @wicklib/core

Canvas2D charting engine: scales, series, axes, crosshair, interactions, panes, indicators,
drawings, annotations, themes, and export.

**Status: 0.1.0.** The public API remains 0.x until 1.0, but the package is on the stable
release channel.

```sh
pnpm add @wicklib/core
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

Calling `setDatafeed()` again stops the previous subscription, aborts its pending requests,
clears loaded bars, and starts the replacement. The previous feed is unsubscribed.

```ts
series.setDatafeed(feed, {
  symbol: "ETH/USD",
  interval: "5m",
  initialView: "fit",
});
```

`initialView` controls the time view after the first load: `auto` fits only when the host has
not chosen a view, `fit` always fits the new data, and `preserve` keeps the current view.
`getDatafeedOptions()` returns the active symbol, interval, initial bar count, and view mode.

## Price formatting

Price labels use the generated tick step by default. Instrument-specific precision can be set
for the whole chart or updated at runtime:

```ts
const chart = createChart(container, {
  priceScale: {
    priceFormat: {
      precision: 2,
      minMove: 0.01,
    },
  },
});

const scale = series.priceScale();
scale.setOptions({ priceFormat: { precision: 4 } });

const current = scale.getOptions().priceFormat;
```

`precision` controls the displayed decimal places. When omitted, `minMove` determines the
precision, for example `0.25` renders two decimals. If neither is set, Wicklib infers
precision from the generated ticks. The format applies to axis ticks, crosshair labels,
drawing labels, price lines, and last-value labels.

## Price scales

Price scales are linear by default. A pane can use a logarithmic scale without recreating the
chart:

```ts
chart.setOptions({ priceScale: { mode: "logarithmic" } });

// Or update only one pane.
series.priceScale().setOptions({ mode: "logarithmic" });
```

Logarithmic scales require positive prices. Explicit non-positive ranges throw
`INVALID_ARGUMENT`; automatic ranges containing non-positive values are ignored so the last
valid range stays visible. Margins are applied in log space, and narrow ranges fall back to
linear price ticks for familiar labels.

## Workspace state

Wicklib does not persist application state. The host can read the state it needs to save:

```ts
const workspace = {
  visibleRange: chart.timeScale().getVisibleRange(),
  timeScale: chart.timeScale().getOptions(),
  panes: chart.getPanes().map((pane) => ({
    id: pane.id,
    height: pane.getHeight(),
    options: pane.getOptions(),
  })),
  series: [
    {
      id: series.id,
      type: series.typeId,
      options: series.getOptions(),
      datafeed: series.getDatafeedOptions(),
    },
  ],
  indicator: {
    inputs: indicator.getInputs(),
    plot: indicator.getPlotOptions("line"),
  },
  drawings: chart.serializeDrawings(),
};
```

Bar data, symbol lists, and the indicator definition registry remain host-owned. Restore by
recreating the chart and series with the host's stored configuration, reattaching datafeeds,
and calling `loadDrawings()`.

## Interaction and layout

- Continuous index-based time scale and linear or logarithmic price scale.
- Time-axis drag zooms; price-axis drag scales the price range.
- Wheel zoom, trackpad pan, drag pan, and two-pointer pinch zoom.
- Keyboard pan/zoom/fit, `Delete`/`Backspace`, `[`/`]` drawing navigation, Cmd/Ctrl+A
  select-all, and a polite live announcement of selection changes.
- Automatic price-axis width from rendered labels.
- Multi-pane layouts with independent price scales and a shared time axis.
- Session calendars, DST, holidays, and optional fixed-width closed-session gaps.
- Drawing tools: trend/horizontal/vertical/cross lines, rays, channels, rectangles,
  Fibonacci retracement/extension, long/short positions, price/date ranges, circles, Elliott
  impulse/correction/triangle/combo patterns, brush/highlighter/path freehand tools, text,
  and measurements. The first Elliott click is the labelled origin.
- Multi-selection: Cmd/Ctrl-click to toggle, Cmd/Ctrl-drag for an additive marquee, group
  move, and group delete. `selectedDrawings()` returns the complete selection.
- Drawing settings: read with `getOptions()`, patch the selection with
  `updateSelectedDrawings()`, and configure future drawings with `setDrawingDefaults()`.
  Use `drawingToolSettings(toolId)` or `DRAWING_TOOL_CATALOG` to build host menus and show
  only relevant controls per tool. `drawing-double-click` lets a host open tool-specific
  editors, such as a text prompt. The menu, icons, settings controls, and persistence remain
  host-owned.
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
