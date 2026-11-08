# RFC-0027: First-class axis styling

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0010 (accepted), RFC-0011 (accepted)

## 1. Context

Axis labels follow `layout.textColor` and `layout.fontSize`, while axis borders reuse grid
colours. Hosts need shared axis styling without introducing per-axis configuration.

## 2. Public API

`LayoutOptions` gains:

- `axisLineColor?: string`
- `axisTextColor?: string`
- `axisFontSize?: number`

The settings are shared by the price and time axes.

## 3. Resolution

- `axisTextColor` falls back to `layout.textColor`.
- `axisFontSize` falls back to `layout.fontSize` and must be positive and finite.
- `axisLineColor` falls back per axis:
  - price border → `grid.horzLines.color`
  - time border → `grid.vertLines.color`
- When set, `axisLineColor` styles both borders.
- Omitting all three options preserves the previous chrome styling.

## 4. Rendering scope

Axis text styling applies to price/time tick labels, last-value axis labels, and price-line
labels rendered on the price axis. Crosshair price/time label boxes use the chart-aware contrast
surface shared with stats boxes instead of `axisTextColor`; an explicit
`crosshair.labelBackground` remains an override with automatic text contrast. The styling does
not affect the series legend, no-data text, drawing text or drawing labels, plot price-line
titles, grids, crosshair lines, series, or drawings.

Crosshair, last-value, and price-line axis label boxes size from the axis font. The price-axis
width is measured with the axis font. The time axis uses
`max(24, ceil(axisFontSize + 16))`, preserving 28px for the default 12px font.

`axisLineColor` only affects axis borders while their existing border visibility is enabled.

## 5. Live updates

`chart.setOptions({ layout: ... })` updates all three settings without recreating the chart.
Font changes recompute axis width, time-axis height, label boxes, and pane layout.

## 6. Acceptance criteria

- Omitted options preserve current fallbacks and default time-axis height.
- Axis text overrides do not affect the legend or drawings.
- Axis font changes resize axis labels, width, height, and label boxes.
- Axis line colour applies to visible borders only.
- Runtime updates redraw immediately.
