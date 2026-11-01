# RFC-0014: Drawing settings and per-tool defaults

- Status: **Accepted** — implemented
- Date: 2026-10-27
- Depends on: RFC-0004 (accepted), RFC-0013 (accepted)

## 1. Context

Drawings expose style fields one at a time, but hosts need to build a settings panel, read the
current style, apply a change to a multi-selection, and configure defaults for newly created
tools.

## 2. Goals

- Expose the resolved settings of any live drawing.
- Apply a partial settings patch to the full selection.
- Configure per-chart defaults for new drawings of each tool.
- Keep settings UI, controls, persistence, and undo/redo in the host.
- Reuse the existing `DrawingOptions` model instead of introducing a parallel one.

## 3. Non-goals

- A built-in settings panel or toolbar.
- Undo/redo and settings persistence.
- Per-user or global preference storage.
- Tool-specific rich-text editing.
- Changing a locked drawing's geometry or deletion behavior.

## 4. Public API

```ts
type DrawingSetting =
  | "color"
  | "lineWidth"
  | "lineStyle"
  | "fillColor"
  | "fillOpacity"
  | "showLabels"
  | "text"
  | "fontSize"
  | "locked"
  | "visible";

interface DrawingApi {
  getOptions(): DrawingOptions;
}

interface ChartApi {
  updateSelectedDrawings(options: Partial<DrawingOptions>): void;
  setDrawingDefaults(toolId: string, options: Partial<DrawingOptions>): void;
  drawingDefaults(toolId: string): DrawingOptions;
}

function drawingToolSettings(toolId: string): readonly DrawingSetting[];
```

`drawingToolSettings()` is the capability matrix for host settings UIs. For example, Elliott
wave tools expose labels but not text/font controls; the text tool exposes text/font but not
line width or fills; fill controls appear only on filled shapes.

`DrawingOptions` covers colour, line width/style, fill colour/opacity, labels, text, font size,
locking, and visibility.

## 5. Behavior

- `getOptions()` returns the resolved current values for that drawing.
- `updateSelectedDrawings()` applies the patch to every selected drawing and emits one
  `drawing-updated` event per drawing.
- Styles may be changed on locked drawings; locking only prevents geometry edits, moving, and
  deletion.
- `setDrawingDefaults()` merges partial settings into the chart's per-tool defaults.
- New drawings resolve in this order: core defaults, tool defaults, chart defaults, explicit
  creation options.
- Existing drawings are not retroactively changed by new defaults.
- Unknown tool ids throw `INVALID_ARGUMENT`.
- Defaults live on the chart instance and are not persisted by core.

## 6. Acceptance criteria

- Hosts can read and patch drawing settings without private APIs.
- Multi-selection settings updates affect exactly the selected drawings.
- Per-tool defaults affect new drawings only.
- The host remains responsible for rendering the settings controls.
