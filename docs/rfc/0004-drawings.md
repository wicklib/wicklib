# RFC-0004: Drawing tools

- Status: **Accepted** — implemented
- Date: 2026-10-26
- Depends on: RFC-0001 (accepted), RFC-0003 (accepted)
- Out of scope: host persistence, accounts, collaboration, custom tool renderers, WickScript

## 1. Context

Indicators are computed series. Drawings are user-authored annotations anchored to chart
coordinates: a trendline between two points, a horizontal price, a rectangle, Fibonacci
levels, a measurement.

Drawings must survive pan, zoom, resize, and pane changes. Their anchors therefore live in
data space (`time`, `price`), never in pixels.

The host owns persistence and undo/redo. The library owns creation, rendering, hit-testing,
selection, editing, and serialization to a versioned document.

## 2. Goals

- Five built-in tools that feel native.
- Programmatic creation and interactive tool mode.
- Selection, movement, anchor editing, deletion.
- Time/price anchors in a specific pane.
- Versioned serialization and loading.
- One dedicated drawing layer below the crosshair.
- Additive API; no core datafeed or persistence.

## 3. Non-goals

- Storing drawings. The host persists `DrawingDocument`.
- Undo/redo stacks. The host builds them from change events.
- Collaborative editing.
- Text annotations and image overlays (later).
- Custom drawing renderers (later RFC).
- Drawing templates, sharing, marketplace.

## 4. Principles

1. **Anchors are data, not pixels.** `{ time, price }` in one pane.
2. **The host persists.** The library serializes; it never writes storage.
3. **One source of truth.** All mutations go through `DrawingApi` and emit events.
4. **One overlay layer.** Drawings render between series and crosshair.
5. **Fail loudly.** Invalid anchors, unknown tools, and locked drawings raise typed errors.
6. **Free tier.** All five built-ins are `license: "free"` in Phase 4.

## 5. Public surface

### 5.1 Types

```ts
export interface DrawingAnchor {
  time: Time;
  price: number;
}

export type DrawingLineStyle = "solid" | "dotted" | "dashed";

export interface DrawingOptions {
  color?: string;
  lineWidth?: number;
  lineStyle?: DrawingLineStyle;
  fillColor?: string;
  fillOpacity?: number;
  showLabels?: boolean;
  locked?: boolean;
  visible?: boolean;
}

export interface DrawingToolDefinition {
  readonly id: string;
  readonly meta: ExtensionMeta;
  readonly anchors: 1 | 2 | 3;
  readonly defaultOptions?: DrawingOptions;
}

export interface AddDrawingOptions {
  paneId?: string;
  anchors: readonly DrawingAnchor[];
  options?: DrawingOptions;
}

export interface DrawingApi {
  readonly id: string;
  readonly toolId: string;
  readonly paneId: string;
  getAnchors(): readonly DrawingAnchor[];
  setAnchors(anchors: readonly DrawingAnchor[]): void;
  setOptions(options: Partial<DrawingOptions>): void;
  remove(): void;
}
```

Built-in tokens exported from core:

```ts
export const TrendLine: DrawingToolDefinition;
export const HorizontalLine: DrawingToolDefinition;
export const Rectangle: DrawingToolDefinition;
export const FibRetracement: DrawingToolDefinition;
export const Measure: DrawingToolDefinition;
```

### 5.2 Chart API

```ts
export interface ChartApi {
  // Existing members...
  addDrawing(tool: DrawingToolDefinition, options: AddDrawingOptions): DrawingApi;

  /** Enter one-shot interactive creation for the tool. */
  startDrawing(tool: DrawingToolDefinition, options?: Partial<AddDrawingOptions>): void;

  cancelDrawing(): void;
  selectedDrawing(): DrawingApi | null;
  selectDrawing(id: string | null): void;

  serializeDrawings(): DrawingDocument;
  loadDrawings(document: DrawingDocument): void;
}
```

- `addDrawing` requires exactly `tool.anchors` anchors. Wrong length throws
  `INVALID_ARGUMENT`.
- `startDrawing` places one anchor per click; preview follows the pointer; completing the
  last anchor commits the drawing and exits tool mode. Escape cancels.
- `loadDrawings` replaces all drawings. It validates the document version and tool ids.

### 5.3 Serialization

```ts
export interface SerializedDrawing {
  id: string;
  toolId: string;
  paneId: string;
  anchors: DrawingAnchor[];
  options: DrawingOptions;
}

export interface DrawingDocument {
  version: 1;
  drawings: SerializedDrawing[];
}
```

- The host stores the document with its own data; the library does not.
- Unknown tool ids are skipped and reported through the `error` event.
- Anchors outside loaded data remain in the document and render when they enter the view.

### 5.4 Events

```ts
export interface ChartEventMap {
  // Existing keys...
  "drawing-created": { drawing: DrawingApi };
  "drawing-selected": { drawing: DrawingApi | null };
  "drawing-updated": { drawing: DrawingApi };
  "drawing-removed": { drawingId: string };
  "drawing-cancelled": { toolId: string };
}
```

- `drawing-updated` fires on anchor or option changes, including drags.
- The host uses these events for undo/redo and persistence. The core keeps no history.

## 6. Coordinate and pane model

- Each drawing belongs to one pane. Anchor prices use that pane's price scale; time uses the
  shared time axis.
- Time is converted with the shared time scale. If the anchor time is between bars, it maps
  to the nearest bar's x; anchors created by the pointer snap to bar times by default.
- Moving a drawing between panes is not supported in Phase 4.
- Removing a pane removes its drawings.
- Auto-created indicator panes with drawings are not auto-removed while drawings remain.

## 7. Tools

| Tool             | Anchors | Behaviour                                           |
| ---------------- | ------- | --------------------------------------------------- |
| `TrendLine`      | 2       | Line extended to the pane edges                     |
| `HorizontalLine` | 1       | Horizontal line at the anchor price                 |
| `Rectangle`      | 2       | Filled rectangle, border                            |
| `FibRetracement` | 2       | Levels 0, .236, .382, .5, .618, .786, 1 with labels |
| `Measure`        | 2       | Price/percent/time delta; transient by default      |

- `Measure` is not persisted by default (`persist: false` internal); the host can opt in later.
- Colors: `#2962ff` default, `#26a69a` for upward measure, `#ef5350` for downward.
- Hidden drawings are not hit-tested.
- Locked drawings cannot be moved, resized, or removed by pointer interaction; `remove()`
  still works.

## 8. Interaction

### Creation

1. `startDrawing(tool)` sets tool mode and clears selection.
2. Each click adds an anchor at the snapped time/price.
3. A preview renders from the current anchors plus the pointer.
4. The last anchor commits and emits `drawing-created`.
5. Escape or `cancelDrawing()` discards the preview and emits `drawing-cancelled`.

Holding Alt disables snapping for that click.

### Selection and editing

- Click a drawing (outside tool mode) selects it; the topmost drawing wins.
- Drag inside the drawing moves all anchors.
- Drag an anchor handle moves that anchor.
- Delete or Backspace removes the selected drawing.
- Escape clears the selection.
- Pan/zoom works normally when no tool is active and no drag is in progress.
- Hit tolerance is 6 CSS pixels; handles are 8×8 CSS pixels.

### Snapping

Default `bar`:

- Time snaps to the nearest bar time.
- Price is free, unless the crosshair magnet mode is active, in which case it snaps to the
  nearest close in the drawing's pane.
- Alt disables snapping.
- Snapping works on touch with the same rules.
- Amendment: ADR-0001 removes price snapping from drawing creation and anchor editing.
  Crosshair magnet continues to affect only the crosshair readout.

## 9. Rendering

- Add a `drawings` canvas layer between `series` and `overlay`.
- Redraw drawings on view changes and drawing mutations; the crosshair does not force a
  drawing repaint.
- Draw only drawings whose time range intersects the visible range.
- Selection draws anchor handles and a subtle highlight.
- Z-order is creation order; the last created drawing renders on top and wins hit-testing.
- Drawing text labels (Fib levels, measure delta) use the chart font and text color.

## 10. Performance

- 1,000 drawings on screen: redraw within one frame budget on the M2 reference.
- Hit-testing only on pointer events, never per frame.
- No per-frame allocations; anchors use small arrays.
- No reflow of the time or price scales.

## 11. Licensing

- All five built-ins are free in Phase 4.
- `meta.license` is carried for future pro tools.
- Pro templates, sharing, and strategy drawings are later.

## 12. Testing

- Anchor serialization round-trip; version validation.
- Programmatic creation for all five tools.
- Interactive creation with pointer clicks and Escape.
- Selection by hit-testing; z-order.
- Drag whole drawing and individual anchors.
- Locked and hidden behavior.
- Pane removal cascade.
- Data changes: drawings stay anchored to time/price.
- Unknown tool ids on load.
- Visual snapshots for each tool and selected state.
- Performance with 1,000 drawings.

## 13. Open questions

Recommendations are what will be implemented unless overridden.

1. **Built-ins only** in Phase 4; custom drawing renderers are a later RFC. (recommended)
2. **Host owns persistence and undo/redo**; core emits events. (recommended)
3. **Default snap** is bar time plus free price; Alt disables. (recommended)
4. **Versioned document** `{ version: 1, drawings }`. (recommended)
5. **Dedicated drawings layer** below the crosshair. (recommended)
6. **Measure is transient** by default. (recommended)
7. **All five built-ins free.** (recommended)
8. **Pane removal cascades** to drawings. (recommended)
9. **Unknown tools skipped with an error event.** (recommended)
10. **No built-in undo stack.** (recommended)

## 14. Acceptance criteria

- The ten decisions are settled.
- All five tools render, create interactively, select, move, edit, and delete.
- Anchors survive pan, zoom, resize, and data changes.
- Serialization round-trips exactly; unknown tools are reported.
- Drawings are pane-scoped and removed with their pane.
- 1,000 drawings render within the frame budget.
- Visual regression covers each tool and the selected state.
- API report regenerated and reviewed.

## 15. Implementation sequence

1. Add the drawings layer to the canvas stack and renderer.
2. Add drawing types, tool tokens, and the chart API.
3. Implement coordinate mapping and snapping.
4. Implement the five tool renderers.
5. Implement hit-testing, selection, handles, drag, and delete.
6. Implement interactive tool mode and preview.
7. Implement serialization and loading.
8. Add tests, visual snapshots, and the 1,000-drawing benchmark.
9. Update the playground with a drawing toolbar.
10. Regenerate the API report and update docs.
