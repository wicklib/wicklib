# RFC-0017: Drawing double-click event

- Status: **Accepted** — implemented
- Date: 2026-10-27
- Depends on: RFC-0004 (accepted), RFC-0013 (accepted)

## 1. Context

Hosts need an editing affordance for text drawings and other tool-specific actions. Core
already handles double-click on the price axis, but drawing hits were only observable through
pointer-down selection.

## 2. Goals

- Emit a typed event when a drawing is double-clicked.
- Preserve existing price-axis double-click reset behavior.
- Keep editing UI in the host.
- Reuse normal drawing hit-testing.

## 3. Non-goals

- Built-in text editing UI.
- Inline canvas text inputs.
- A new drawing-editing mode.
- Changing single-click selection semantics.

## 4. Public API

```ts
chart.on("drawing-double-click", ({ drawing, point }) => {
  // host-specific action, such as a text edit prompt
});
```

The event payload includes the live `DrawingApi` and the local chart point.

## 5. Behavior

- Double-clicking a drawing selects it and emits the event.
- Topmost drawing wins.
- Price-axis double-click still restores auto-scale when no drawing is hit.
- An active path tool finishes before drawing double-click handling.
- The playground uses this event to prompt for text editing on text drawings.

## 6. Acceptance criteria

- Line and text drawings emit the event.
- The event includes the selected drawing and pointer point.
- Axis reset behavior remains unchanged.
