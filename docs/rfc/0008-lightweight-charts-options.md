# RFC-0008: lightweight-charts option mapping

- Status: **Accepted** — implemented
- Date: 2026-10-27
- Depends on: RFC-0001 (accepted)

## 1. Context

Existing hosts, including trade-journal notebook embeds, create charts with
lightweight-charts options. Requiring every host to hand-map those options makes migration
error-prone, especially for wheel, pinch, and axis interactions.

## 2. Goals

- Provide a small, dependency-free mapper for the supported lightweight-charts options.
- Preserve common layout, grid, crosshair, price-scale, time-scale, and locale settings.
- Map interaction flags to explicit Wicklib interaction controls.
- Reject unsupported price-scale modes rather than silently changing meaning.

## 3. Non-goals

- Source-level API compatibility with lightweight-charts.
- Mapping custom series, primitives, plugins, or watermarks.
- Emulating every lightweight-charts interaction or drawing feature.
- Accepting unsupported options silently.

## 4. Public API

```ts
function mapLightweightChartOptions(options: LightweightChartOptions): ChartOptions;
```

The mapper returns native `ChartOptions`; it does not add a compatibility mode to the chart.
Unknown fields are ignored. Unsupported price-scale modes such as percentage and
indexed-to-100 throw `NOT_IMPLEMENTED`.

Interaction mapping:

- Wheel is chart-wide. Disabling either `handleScroll.mouseWheel` or
  `handleScale.mouseWheel` disables both wheel pan and zoom.
- `pressedMouseMove` or `horzTouchDrag` enables drag panning.
- `pinch` enables two-pointer zoom.
- `axisPressedMouseMove` enables price-axis dragging.
- `axisDoubleClickReset` enables double-click auto-scale reset.

## 5. Behavior

- Solid backgrounds map to their colour string.
- Numeric crosshair modes and line styles map to Wicklib enums.
- `rightPriceScale` maps to Wicklib's single native price scale.
- `timeScale.borderVisible` controls the time-axis border.
- Width, height, auto-size, and locale map directly.
- Sparse inputs emit only the interaction fields affected by the supplied flags; omitted
  options never inject defaults.

## 6. Acceptance criteria

- Notebook-embed options map without host-specific branching.
- Wheel input can be disabled while drag and pinch remain active.
- Time-axis and price-axis borders can be hidden.
- Unsupported price modes fail with a typed error.
