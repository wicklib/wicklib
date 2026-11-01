# RFC-0013: Expanded drawing tools and multi-selection

- Status: **Accepted** — phased implementation
- Date: 2026-10-27
- Depends on: RFC-0004 (accepted)

## 1. Context

The drawing API covers trend lines, horizontal levels, rectangles, Fibonacci retracements, and
measurements. Hosts need additional analyst tools and multi-selection workflows while keeping
the visual toolbar under host control.

## 2. Goals

- Add the remaining pointer-defined drawing tools in small, testable batches.
- Preserve version-1 drawing documents and existing tool ids.
- Keep drawing UI, icons, labels, localization, and permissions in the host application.
- Add multi-selection without breaking the single-selection API.
- Support additive selection and marquee selection.

## 3. Non-goals

- A built-in toolbar, menu, icon set, or style panel.
- Persistence, undo/redo, or collaboration.
- Custom drawing renderers.
- Additional Elliott-wave pattern variants beyond the approved set.

## 4. Tool batches

### Batch 1 — implemented

- `horizontal-ray`
- `vertical-line`
- `cross-line`
- `parallel-channel`
- `fib-extension`
- `long-short-position`
- `price-date-range`
- `circle`

### Batch 2 — implemented

- Cmd/Ctrl-click toggles drawings in the selection.
- Cmd/Ctrl-drag on empty plot creates an additive marquee selection.
- Delete/Backspace removes every selected unlocked drawing.
- Dragging any selected drawing moves the complete selected group.
- Anchor editing remains single-drawing.
- Existing `drawing-selected` remains; a new `drawing-selection` event carries the full set.

### Batch 3 — freehand and text

- `brush`
- `highlighter`
- `path`
- `text`

These need variable anchor counts, freehand capture, and text editing semantics.

### Batch 4 — implemented

- `elliott-impulse` — labels 1, 2, 3, 4, 5.
- `elliott-correction` — labels A, B, C.
- `elliott-triangle` — labels A, B, C, D, E.
- `elliott-double-combo` — labels W, X, Y.
- `elliott-triple-combo` — labels W, X, Y, X, Z.

Each pattern is a polyline with labelled anchors. Parallel channels show a ghost base line
before the third anchor is placed.

## 5. Multi-selection API direction

```ts
type DrawingSelectionMode = "replace" | "add" | "toggle";

interface SelectDrawingOptions {
  mode?: DrawingSelectionMode;
}

chart.selectDrawing(id, { mode: "toggle" });
chart.selectedDrawings(): readonly DrawingApi[];
```

`selectDrawing(null)` clears the selection. `selectedDrawing()` keeps returning the first
selected drawing for compatibility.

## 6. Acceptance criteria

- Batch 1 tools create, render, hit-test, serialize, and restore.
- Existing drawing behavior and documents remain compatible.
- Multi-select supports additive toggle, marquee selection, group delete, and group move.
- Freehand/text tools are added only after their capture and editing contracts are defined.
