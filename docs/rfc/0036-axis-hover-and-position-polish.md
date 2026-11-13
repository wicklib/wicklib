# RFC-0036: Axis density, drawing hover, position stats, and measure presentation

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0010 (accepted), RFC-0035 (accepted)

## 1. Changes

- Price axes request denser ticks using a height/30 target.
- Hovering a drawing now renders its selection handles without selecting it.
- Position stats boxes place profit outside the target extreme and stop outside the stop
  extreme. Entry remains centered.
- Position `lossPercent` and new `profitPercent` use price distance from entry, not account risk.
- Profit amount renders without a "Profit" prefix.
- Measure uses a TradingView-style overlay with endpoint dots, projection guides, a contrast
  surface, price/percent change, bar count, and duration. Preview rendering derives the second
  time from the preview x-position until a second anchor is committed.
- Legacy Long/Short Position remains hidden from the new-tool catalog.

## 2. Acceptance criteria

- Tall panes show more price ticks without overlaps.
- Hovering shows knobs; clicking still selects.
- Position percentages follow actual stop/target distances.
- Profit/stop boxes sit outside their zones.
- Measure remains transient but visually informative.
