# RFC-0034: Draggable price lines

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0001 (accepted)

## 1. Context

Hosts need interactive position levels without host-side hit areas or handle grids. Price lines must
support pointer, touch, pen, and keyboard interaction in multi-chart layouts.

## 2. Public API

`PriceLineOptions` gains `id`, `draggable`, `dragConstraint`, `dragSnap`, and drag callbacks.

`PriceLineDragEvent` carries id, phase, price, previous/original price, pointer, and source.

`PriceLineApi` gains `getPrice`, `setPrice`, `setDraggable`, `setDragConstraint`, and `focus`.

## 3. Interaction

- Dragging uses a 6px screen-space hit slop, pointer capture, and an `ns-resize` cursor.
- Live price preview updates the line and axis label; commit occurs on pointer up.
- Escape or pointer cancel restores the original price.
- Chart pan/zoom/drawing interaction is blocked while a price line is dragged.
- Constraints: `above`, `below`, and `range`; `above`/`below` default to the original price.
- `tick` snapping and supplied tick/precision metadata are applied.
- Optional magnet snapping uses the existing magnet configuration while excluding price lines from
  the candidate set to avoid self-snapping.
- Keyboard uses ArrowUp/ArrowDown, Shift for 10x steps, Enter to commit, Escape to cancel.
- Programmatic `setPrice` never emits drag callbacks.

## 4. Acceptance criteria

- Dragging redraws line and axis label continuously.
- Constraints prevent invalid crossings.
- Mouse, touch, pen, and keyboard produce the same event phases.
- Only the active chart handles the interaction in multi-chart layouts.
- Existing price lines remain unchanged when new options are omitted.
