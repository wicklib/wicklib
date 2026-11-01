# RFC-0016: Drawing keyboard navigation and announcements

- Status: **Accepted** — implemented
- Date: 2026-10-27
- Depends on: RFC-0004 (accepted), RFC-0013 (accepted)

## 1. Context

Drawings can be selected, moved, styled, and deleted with a pointer. Keyboard users need a
reliable way to traverse the drawing collection and determine what is selected.

## 2. Goals

- Select the next/previous drawing without a pointer.
- Select all drawings with the conventional shortcut.
- Announce selection changes through an ARIA live region.
- Keep chart pan/zoom keyboard shortcuts intact.
- Expose the same navigation through the public API.

## 3. Non-goals

- Full screen-reader descriptions of drawing geometry.
- A DOM representation of every drawing.
- Focus trapping.
- Keyboard resizing or anchor editing.
- Host-specific focus order.

## 4. Public API

```ts
chart.selectNextDrawing(options?);
chart.selectPreviousDrawing(options?);
chart.selectAllDrawings();
```

## 5. Keyboard behavior

- `]` selects the next drawing, wrapping at the end.
- `[` selects the previous drawing, wrapping at the start.
- Cmd/Ctrl+A selects all drawings.
- Existing Delete/Backspace, Escape, arrow, zoom, and Home shortcuts remain unchanged.
- The canvas root advertises shortcuts with `aria-keyshortcuts`.

## 6. Announcements

- The chart root contains a visually hidden polite live region.
- One selected drawing announces its human-readable tool name.
- Multiple drawings announce the count.
- Clearing the selection announces that it was cleared.
- Pointer and API selection use the same announcement path.

## 7. Acceptance criteria

- Next/previous wraps in drawing order.
- Cmd/Ctrl+A selects every drawing.
- Selection changes update the live region.
- Existing drawing keyboard deletion still works.
