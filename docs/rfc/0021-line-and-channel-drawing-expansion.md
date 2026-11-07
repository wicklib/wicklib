# RFC-0021: Line, channel, and measurement drawing expansion

- Status: **Accepted** — implemented
- Date: 2026-11-03
- Depends on: RFC-0004 (accepted), RFC-0013 (accepted), RFC-0015 (accepted)

## 1. Context

The drawing catalog covers the common line, channel, Fibonacci, shape, position, range,
Elliott, freehand, text, and measurement tools. Several standard analysis tools are still
missing: persistent stats lines, diagonal rays, extended lines, trend angles, arrows, derived
channels, Fib time zones, pitchforks, Gann fans, and speed lines.

## 2. Goals

- Add high-value line and channel tools without changing the drawing document version.
- Reuse existing anchor, selection, hit-testing, settings, and persistence paths.
- Keep all additions free in `@wicklib/core`.
- Make data-derived tools deterministic and bounded in render cost.

## 3. Non-goals

- Custom drawing renderers supplied by hosts.
- Server-side persistence or collaboration.
- Full TradingView feature parity.
- New drawing-document storage fields.

## 4. Tool set

Phase A:

- Stats Line — persistent price/percentage/duration measurement. Uses drawing color.
- Ray — diagonal forward ray.
- Extended Line — infinite line through two anchors.
- Trend Angle — segment with a screen-space angle label.
- Arrow — segment with a terminal arrowhead.

Phase B:

- Regression Trend — least-squares price regression with ±1 standard-deviation bands.
- Flat Top/Bottom — sloped base plus horizontal boundary.
- Disjoint Channel — two independent boundaries with four anchors.
- Fib Channel — parallel Fib levels between a base and offset line.

Phase C:

- Fib Time Zone — vertical lines at Fibonacci multiples of the base interval.
- Pitchfork, Schiff Pitchfork, Modified Schiff Pitchfork — three-anchor forks with parallel
  tines.
- Gann Fan — nine ratio rays from a pivot.
- Speed Lines — three-ray fan through one-third and two-third retracement points.

## 5. Behavior

- All tools use the existing two-to-four anchor collection and preview path.
- `StatsLine` persists and uses `DrawingOptions.color`; `Measure` remains transient and uses
  directional green/red coloring.
- Regression Trend uses the first visible series in the pane and samples at most 2,000 bars.
- Performance/render calls are bounded; no query occurs outside a pane's render pass.
- Hit testing uses tool geometry; Regression Trend uses its anchor line as a selection proxy.
- Disjoint Channel fills only where the two boundaries overlap in time.
- Flat Top/Bottom ignores the third anchor's time for span and uses only its price.
- Gann ratios are `1x8, 1x4, 1x3, 1x2, 1x1, 2x1, 3x1, 4x1, 8x1`.
- Pitchfork variants follow common definitions: Andrews uses P0; Schiff shifts the origin
  vertically halfway toward P1; Modified Schiff uses the P0–P1 midpoint on both axes.

## 6. API impact

Each tool is exported from `@wicklib/core`, included in `DRAWING_TOOL_CATALOG`, and has
`drawingToolSettings()` metadata. No new public option types are required.

## 7. Acceptance criteria

- All tools create, select, style, save, and restore through the existing drawing API.
- Stats Line uses its configured color.
- Preview rendering never reads a missing second anchor.
- Hit testing selects every tool through its rendered geometry or documented proxy.
- Existing drawing tests and visual interaction tests continue to pass.
- Core remains within the updated bundle budget.
