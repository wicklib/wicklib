# @wicklib/layouts

Free, framework-agnostic multi-chart layouts for Wicklib.

`@wicklib/layouts` owns the reusable parts of a market workspace:

- Multiple chart instances in a CSS grid
- Per-chart chart options
- Active chart tracking
- Visible time-range synchronization
- Mirrored vertical crosshair lines
- Structural layout serialization

It does **not** own symbol state, data transport, persistence, accounts, or product UI.
Those remain with the host application.

## Usage

```ts
import { CandlestickSeries } from "@wicklib/core";
import { createChartLayout } from "@wicklib/layouts";

const layout = createChartLayout(container, {
  columns: 2,
  gap: 8,
  chartOptions: { autoSize: true },
});

const left = layout.addChart({ id: "primary" });
const right = layout.addChart({ id: "comparison" });

left.chart.addSeries(CandlestickSeries).setData(leftBars);
right.chart.addSeries(CandlestickSeries).setData(rightBars);

layout.setActiveChart(left.id);
```

The host container must have a measurable height. The layout fills it with a CSS grid.

## Synchronization

Time-range and crosshair synchronization are enabled by default.

```ts
const layout = createChartLayout(container, {
  columns: 2,
  syncTimeRange: true,
  syncCrosshair: true,
});
```

Time-range sync uses the chart `visible-range` event. Crosshair sync mirrors the vertical
time line through chart overlays; the hovered chart keeps its native crosshair.

## Persistence

```ts
const saved = layout.serialize();
```

`serialize()` returns only grid structure:

```json
{
  "version": 1,
  "columns": 2,
  "gap": 8,
  "slots": [
    { "id": "primary", "rowSpan": 1, "columnSpan": 1 },
    { "id": "comparison", "rowSpan": 1, "columnSpan": 1 }
  ]
}
```

Persist chart state, symbol metadata, datafeed identity, drawings, and layout structure in
the host. Drawings can be read with `chart.serializeDrawings()`.

## Styling

The package adds structural classes and data attributes only:

```css
.wicklib-chart-layout {
  background: #0b0e14;
}

.wicklib-chart-layout__cell[data-active="true"] {
  outline: 1px solid #5b8cff;
  outline-offset: -1px;
}
```

## Cleanup

```ts
layout.destroy();
```

This destroys every chart, removes overlays and event listeners, and removes the layout root.
