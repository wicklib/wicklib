# RFC-0023: Elliott drawing label overrides

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0004 (accepted), RFC-0013 (accepted)

## 1. Context

Elliott wave degrees differ by label convention, not geometry. Creating a separate drawing tool
for every degree and pattern combination would bloat the catalog and fragment persistence.

## 2. Public API

`DrawingOptions` gains an optional label sequence:

```ts
series.addDrawing(ElliottImpulse, {
  anchors,
  options: { labels: ["0", "i", "ii", "iii", "iv", "v"] },
});
```

The override is copied, validated, returned by `getOptions()`, accepted by `setOptions()`, and
serialized with the drawing.

## 3. Behavior

- Tools without label overrides keep their built-in labels.
- The host owns degree names, conventions, defaults, and menus.
- A custom sequence applies one label per anchor; missing entries render nothing.
- Invalid non-string entries throw `INVALID_ARGUMENT`.
- No drawing-document version bump is required.

## 4. Acceptance criteria

- Label overrides persist through `serializeDrawings()` / `loadDrawings()`.
- Existing Elliott labels are unchanged by default.
- Invalid label arrays fail clearly.
- Degree catalogs are not added to core.
