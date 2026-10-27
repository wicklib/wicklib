# RFC-0006: Extension overlays

- Status: **Accepted** — implemented
- Date: 2026-10-27
- Depends on: RFC-0001 (accepted), RFC-0003 (accepted)

## 1. Context

Commercial analytics need to draw custom visuals inside a chart pane without importing core
internals or replacing the renderer. The first use case is a volume-profile histogram. The
host owns licensing; core owns geometry and paint order.

## 2. Goals

- Add public per-pane Canvas2D overlays.
- Give overlays the same time and price coordinate helpers as built-in drawings.
- Keep the renderer and canvas stack private.
- Keep overlays below drawings and crosshair, above series.
- Remove overlays with their pane and on chart destruction.
- Keep licensing outside core.

## 3. Non-goals

- Custom WebGL renderers, hit-testing, or pointer routing.
- Custom panes or time-scale policy.
- Built-in analytics or data sources.
- A global extension registry.

## 4. Public API

```ts
interface ChartOverlay {
  readonly id: string;
  readonly paneId?: string; // defaults to main
  draw(context: CanvasRenderingContext2D, frame: OverlayRenderFrame): void;
}

interface OverlayRenderFrame {
  paneId: string;
  plot: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  visibleRange: VisibleRange;
  timeToX(time: Time): number | null;
  priceToY(price: number): number;
  yToPrice(y: number): number;
}
```

`chart.addOverlay(overlay)` returns an `OverlayApi` with `id`, `paneId`, `requestRender()`,
and `remove()`.

## 5. Rendering and lifecycle

- Overlays render on a dedicated canvas layer: grid → series → overlays → drawings → crosshair.
- Core clips each overlay to its pane plot.
- The context is DPR-scaled; overlay coordinates are CSS pixels.
- `draw` is synchronous and must not allocate long-lived canvas state.
- Duplicate ids throw `DUPLICATE_OVERLAY`.
- Removing a pane removes its overlays; auto-created panes with overlays are retained.
- Chart destruction drops all overlays.
- Overlays are drawn on every chart render; `requestRender()` schedules one.

## 6. Licensing

Core does not inspect licenses. A pro helper checks `LicenseContext` before adding the
overlay. The overlay itself remains a generic core primitive.

## 7. Acceptance criteria

- Overlays receive the correct pane, plot, and coordinate helpers.
- Duplicate ids fail with a typed error.
- Pane removal and destruction release overlays.
- An overlay can draw a volume profile histogram without core internals.
