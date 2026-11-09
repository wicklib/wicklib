# RFC-0031: Shift angle snapping while drawing

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0013 (accepted), RFC-0030 (accepted)

## 1. Context

Line and channel drawings need TradingView-style angle constraints while drawing or resizing.

## 2. Behavior

Holding Shift constrains the active segment to the nearest 45-degree increment in screen space.

- The first anchor is placed normally.
- Subsequent angle-relevant anchors snap relative to their reference anchor.
- Releasing Shift restores free-angle preview and placement.
- Holding or releasing Shift while the pointer is stationary immediately updates the preview/drag.
- Shift angle takes priority over magnet when both are active; the length from the magnet-snapped
  point is preserved while direction is constrained.

## 3. Scope

Applied to:

- Trend line, ray, extended line, arrow, trend angle
- Measure and stats line
- Gann fan
- Parallel channel, Fib channel, flat top/bottom
- Speed lines and pitchfork variants
- Disjoint channel, with references pair-wise between its two lines

Not applied to time-range, price-range, position, Fibonacci, rectangle/circle, text, or freehand
drawings.

## 4. Acceptance criteria

- Angle snapping uses screen coordinates, not price/time coordinates.
- Existing drawing placement and dragging remain unchanged without Shift.
- Shift preview, placement, and anchor dragging use the same angle constraints.
- Channel and disjoint-channel reference anchors are handled correctly.
