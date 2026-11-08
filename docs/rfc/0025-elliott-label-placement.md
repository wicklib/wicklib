# RFC-0025: Elliott label placement

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0023 (accepted), RFC-0024 (accepted)

## 1. Context

Elliott labels were drawn to the right of their anchors. The conventional presentation centers
labels above local highs and below local lows.

## 2. Public API

```ts
type DrawingLabelPlacement = "auto" | "above" | "below";

interface DrawingOptions {
  labelPlacement?: DrawingLabelPlacement; // defaults to "auto"
}
```

No legacy `"right"` mode is retained.

## 3. Behavior

- `auto` centers each Elliott label on its anchor.
- Local highs get labels above; local lows get labels below.
- Endpoint anchors compare against their single neighbor.
- If a preferred side would leave the pane, the label flips to the other side.
- Vertical offset uses `labelFontSize` plus padding.
- Boxless label behavior and custom label sequences remain unchanged.
- Exact horizontal placement uses centered text and a symmetric background box.

## 4. Compatibility

Existing drawings omit `labelPlacement`, so they receive `"auto"` and their labels move to the
conventional position. This is a visual change only; no drawing-document or database migration
is required.

## 5. Acceptance criteria

- All five Elliott tools use the shared placement logic.
- Impulse, correction, triangle, double combo, and triple combo are covered by tests.
- Highs render above and lows below.
- Forced `above` and `below` modes work.
- Boxless and custom-size labels continue to work.
