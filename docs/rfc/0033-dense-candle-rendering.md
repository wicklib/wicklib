# RFC-0033: Dense candle rendering for narrow panes

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0012 (accepted)

## 1. Root cause

`drawCandles` switched to `drawAggregatedCandles` below 1.5px spacing. The aggregated path filled
one full-height 1px column for every screen pixel using the aggregated high/low range. In narrow
panes many columns became contiguous solid slabs, losing candle direction and visual gaps.

## 2. Approach

The high-density path now renders a stable dense representation instead of filled columns:

- One low-opacity high/low envelope column per screen pixel, coloured by aggregated direction.
- A higher-opacity close-price line connecting adjacent columns.
- Gaps break the close line instead of bridging.
- Fractional bar spacing and high-DPI scaling continue to use CSS-pixel coordinates.
- Normal candle bodies, wicks, borders, and custom colours remain unchanged above the threshold.
- Line/area/histogram series are unaffected.

No public option, `maxVisibleBars`, or `minBarSpacing` semantics changed.

## 3. Acceptance criteria

- A 300px pane with 720 bars uses the dense representation without solid candle fills.
- A 1200px pane with the same data still renders normal candle bodies.
- Narrow panes remain readable through the envelope and close line.
- No host-side zoom or spacing workaround is required.
