# RFC-0033: Dense candle rendering for narrow panes

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0012 (accepted)

## 1. Root cause

`drawCandles` switched to `drawAggregatedCandles` below 1.5px spacing. The aggregated path filled
one full-height 1px column for every screen pixel using the aggregated high/low range. In narrow
panes many columns became contiguous solid slabs, losing candle direction and visual gaps.

## 2. Approach

Dense candles now use sub-pixel candle geometry instead of aggregated columns or a line-style
representation:

- Every candle keeps its own wick and body.
- Body width scales below one CSS pixel instead of being forced to a 1px slab.
- Wicks use a fractional line width in dense mode to avoid solid pixel columns.
- Body minimum height is reduced in dense mode while preserving direction and high/low.
- Borders are skipped when the body is narrower than one pixel.
- Fractional spacing and high-DPI rendering use CSS-pixel coordinates.
- Normal candle geometry, colours, and borders remain unchanged at wider spacing.
- Line/area/histogram series are unaffected.

No public option, `maxVisibleBars`, or `minBarSpacing` semantics changed.

## 3. Acceptance criteria

- A 300px pane with 720 bars renders sub-pixel candle bodies and wicks, not aggregated slabs.
- A 1200px pane with the same data still renders normal candle bodies.
- Narrow panes keep candle shape, direction, wicks, and high/low.
- No host-side zoom or spacing workaround is required.
