# RFC-0028: Position and range drawing suite

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0013 (accepted), RFC-0024 (accepted), RFC-0027 (accepted)

## 1. Context

Hosts need dedicated long and short position tools with one-click placement, draggable levels and
width, colour-aware labels, axis prices, and position stats. They also need consistent price,
time, and date/price range drawings with extensions and range statistics.

## 2. Position tools

New tools:

- `long-position`
- `short-position`

Both use `capture: "position"` and create four internal anchors from one click: entry, stop,
target, and right-edge width. The generated levels are:

- Entry: clicked price.
- Stop: entry ± one ATR over the latest 14 bars.
- Target: entry ± two times the risk.
- Width: 20 bars unless the chart has no data, in which case a fallback interval is used.
- If ATR is unavailable, risk falls back to 1% of entry.

The initial risk/reward is 1:2. The user can drag entry, stop, target, and the right edge. Width is
not forced to the chart edge.

Position visuals:

- Stop zone uses `stopColor`, target zone uses `targetColor`.
- No zone borders; only the entry line remains.
- Entry line, entry label, and target label use `targetColor`.
- Stop label uses `stopColor`.
- Labels are `"Stop"`, `"Entry"`, and `"Profit"`.
- `labelTextColor` optionally overrides automatic label text contrast.
- `labelFontSize` controls label size.
- `priceLabels` defaults to `always`; stop/entry/target axis labels use their zone colours with
  automatic contrast text.

Position stats:

- `risk`
- `reward`
- `riskReward`
- `riskPercent`
- `rewardPercent`

New positions default to `stats: "selected"` with `statsFields: ["riskReward"]`.

The existing `long-short-position` tool remains loadable for saved documents.

## 3. Range tools

Tools:

- `price-range`
- `time-range`
- `price-date-range` (displayed as Date and Price Range)

All use two anchors and share:

- Line colour and style through `color`, `lineWidth`, `lineStyle`.
- Shape fill through `fillColor` and `fillOpacity`; default opacity is 0.1.
- `extend` master switch plus `extendTop`, `extendBottom`, `extendLeft`, `extendRight`.
- `labelTextColor` and `labelFontSize` for the info box.
- `stats`, `statsFields`, and `statsPosition`.

Defaults:

- Price Range extends left and right.
- Time Range extends top and bottom.
- Date and Price Range is bounded.

Range info boxes default to `stats: "always"` with bars, time range, and volume. Price Range and
Date and Price Range also include the price range.

Volume is the sum of finite volume values from the first visible OHLC series between the anchor
times. It uses compact locale-aware formatting and is skipped when no volume exists.

The existing `price-date-range` ID is preserved for persistence compatibility.

## 4. Acceptance criteria

- One-click position creation expands to four draggable anchors.
- Long and short directions and 1:2 target placement are correct.
- Position labels, fills, stats, and axis labels render with the configured colours.
- Stop/target zones have no borders; the entry line remains.
- Ranges render fills, lines, extensions, labels, bars, time, price, and volume statistics.
- Existing saved drawings continue to load.
