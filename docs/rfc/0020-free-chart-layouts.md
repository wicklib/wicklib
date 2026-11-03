# RFC-0020: Free multi-chart layouts

- Status: **Accepted** — implemented
- Date: 2026-11-03
- Depends on: RFC-0001 (accepted), RFC-0003 (accepted), RFC-0006 (accepted)

## 1. Context

Wicklib core owns one chart with independent panes. Platforms need multiple charts arranged in a
grid with synchronized time ranges and a shared crosshair. That is different from panes: each
cell can have its own symbol, timeframe, datafeed, drawings, and chart options.

Basic chart composition is not a defensible commercial capability. It should be free so hosts
can build free or paid products on top of it.

## 2. Goals

- Provide a free companion package, `@wicklib/layouts`.
- Keep `@wicklib/core` focused on one chart.
- Support responsive grid placement, active-chart tracking, time-range sync, configurable
  crosshair sync, runtime sync changes, and sync groups.
- Keep persistence, symbols, data transport, auth, and product UI host-owned.
- Remove basic layout capabilities from the Pro feature list.

## 3. Non-goals

- Drag-to-dock or resizable split-pane UI.
- Symbol pickers, watchlists, or Supabase persistence.
- Server-synchronized workspaces.
- More than one independent layout implementation in the Wicklib project.

## 4. Package boundary

```text
@wicklib/core      one chart, panes, series, drawings, events       free
@wicklib/layouts   grid + synchronization + structural snapshots   free
@wicklib/pro       analytics, alerts, strategy, premium scripting  paid
```

The umbrella `wicklib` package re-exports core, indicators, and layouts. The script runtime
remains a separate install because of its worker payload.

## 5. Public API

```ts
const layout = createChartLayout(container, {
  columns: 2,
  gap: 8,
  chartOptions: { autoSize: true },
  sync: { timeRange: true, crosshair: "full" },
});

layout.setSyncOptions({ timeRange: false, crosshair: "time" });

const primary = layout.addChart({ id: "primary" });
const comparison = layout.addChart({ id: "comparison" });

layout.setActiveChart(primary.id);
layout.onActiveChange((id) => {});
const snapshot = layout.serialize();
```

Each slot exposes its chart, container, id, and grid spans. `serialize()` returns structural state
only; chart state and persistence remain host-owned.

## 6. Synchronization

- `visible-range` events from one chart set the visible range on every other chart.
- A guard prevents feedback loops.
- Invalid ranges from incompatible data are ignored per chart.
- Crosshair sync supports `off`, `time`, and `full` modes. `time` mirrors the vertical time
  line; `full` also mirrors a horizontal line at the same relative pane height.
- The hovered chart keeps its native crosshair; other charts draw overlays.
- Runtime `setSyncOptions()` changes behavior without recreating charts.
- Slots can be assigned to sync groups so independent chart groups can coexist.
- Extension overlays must survive `loadDrawings()`; loading drawings must not clear unrelated
  overlays.

## 7. Licensing boundary

- Panes and multi-chart layouts are free.
- Remove `panes` and `layouts` from `Feature` and from Pro’s capability descriptors.
- Pro may gate advanced analytics and automation, but not basic chart composition.
- Integrators decide whether their own layout features are free or paid.

## 8. Acceptance criteria

- `@wicklib/layouts` builds, publishes, and has an API report.
- Time ranges synchronize without recursive event loops and respect sync groups.
- Runtime sync changes apply without recreating charts.
- Crosshair overlays are not removed by drawing loads.
- Removing or destroying the layout destroys all charts and listeners.
- Pro no longer advertises layout capabilities.
- Core size remains within budget and layouts stay under 4 kB brotlied.
