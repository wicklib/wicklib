# RFC-0035: Drawing consistency fixes

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0013 (accepted), RFC-0032 (accepted)

## 1. Changes

- Unified the default drawing line colour to `#787b86`.
- Fixed horizontal/vertical text placement for left/right and top/bottom alignment.
- Parallel Channel now renders six fixed virtual handles: three along each line.
- Parallel Channel defaults to `#787b86` with a dashed middle line.
- Trend-line/statistics boxes no longer clamp to the left edge.
- Elliott stats boxes use the chart layout font size and no longer inherit degree label size.
- Arrow exposes trend-line presentation settings.
- Rectangle middle line defaults off.
- Flat Top/Bottom, Disjoint Channel, and Fib Channel use channel/Fibonacci style settings.
- Circle supports fill visibility, line visibility, and text settings.
- Path supports line style.
- Text borders honour border radius.
- Legacy Long/Short Position is hidden from the new-tool catalog while remaining loadable.

## 2. Acceptance criteria

- Text alignment positions work independently for horizontal and vertical tools.
- Parallel Channel handles stay at the six fixed line positions.
- Stats boxes do not stick to the left edge.
- Elliott stats boxes match normal stats box sizing.
- Existing saved drawings still load.
