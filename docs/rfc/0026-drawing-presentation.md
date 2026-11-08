# RFC-0026: Drawing presentation, stats, and theme colors

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0004 (accepted), RFC-0024 (accepted)

## 1. Context

Hosts need consistent drawing presentation controls without app-level canvas work: theme-aware
colors, line-only visibility, trend-line extensions, axis price labels, text styling, and stats
boxes.

## 2. Public API

Drawing options gain:

- `color`, `fillColor`, `textColor`: string or `"theme"`; `null`/empty clears to theme.
- `showLine`
- `extendLeft`, `extendRight`, `showMidpoint`
- `priceLabels`: `never` | `selected` | `always`
- `text`, `textColor`, `fontSize`, `textStyle`, `textAlign`, `textVerticalAlign`
- `stats`: `off` | `selected` | `always`
- `statsPosition`: `auto` | `left` | `center` | `right`

## 3. Behavior

- Theme colors resolve against the chart layout text color at render time.
- Lines, fills, labels, text, stats, and price labels use resolved colors.
- `showLine: false` keeps labels and stats while hiding line geometry.
- Trend-line extensions affect rendering; price labels remain at the two anchor prices.
- Text supports normal/bold/italic/bold-italic, horizontal left/center/right, and vertical
  top/middle/bottom.
- Stats boxes are drawn inside the plot and contain tool-appropriate values.
- Axis price labels are drawn outside the plot on the price axis and participate in axis-width
  measurement.
- Defaults preserve existing drawings: theme is not forced, lines are shown, price labels are
  never, and stats are off.

## 4. Acceptance criteria

- Empty/null colors do not leave stale canvas styles.
- Theme colors update when the chart theme changes.
- Line labels, text, stats, and axis labels use the resolved color.
- Trend-line extensions, midpoint, text, axis labels, and stats render correctly.
- Options persist through drawing serialization.
