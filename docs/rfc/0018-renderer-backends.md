# RFC-0018: Renderer backends and target workload

- Status: **Accepted** — Canvas2D reference and hybrid WebGL2 backend implemented
- Date: 2026-10-27
- Depends on: RFC-0001 (accepted)

## 1. Context

Canvas2D currently renders every layer directly. The product direction explicitly requires a
WebGL2 backend, so WebGL cannot remain a contingency patched on after the public surface
stabilizes. The renderer needs a backend-neutral seam now.

## 2. Target workload

The initial backend target is:

- 1,000,000 OHLC bars.
- 60 fps pan and zoom on desktop hardware.
- Four simultaneous series.
- Up to eight indicator panes.
- DPR 2 displays.
- Interactive drawing and crosshair behavior without main-thread stalls.
- Graceful Canvas2D fallback when WebGL2 is unavailable.

These are engineering targets, not public performance guarantees.

## 3. Goals

- Introduce a backend-neutral renderer contract.
- Keep Canvas2D as the reference implementation.
- Allow a WebGL2 backend without changing the public chart API.
- Preserve Canvas2D for crisp text, axes, labels, drawings, overlays, and crosshair.
- Keep screenshots and DPR behavior identical across backends.
- Add backend-specific performance and regression tests.

## 4. Non-goals

- Removing Canvas2D.
- Rendering text in WebGL.
- Requiring WebGL2.
- Changing extension overlay or drawing contracts.
- Selecting a backend publicly before the WebGL2 implementation is complete.

## 5. Architecture

```ts
interface RendererBackend {
  readonly kind: "canvas2d" | "webgl2";
  readonly root: HTMLElement;
  resize(width: number, height: number, dpr: number): void;
  render(model: ChartRenderModel): void;
  compose(): HTMLCanvasElement;
  measureText(text: string, font: string): number;
  announce(message: string): void;
  destroy(): void;
}
```

- `Chart` depends on `RendererBackend`, not Canvas2D classes.
- `Canvas2DRenderer` wraps the existing canvas stack and renderer.
- `WebGL2Renderer` owns a hybrid layer stack:
  - Canvas2D for grid, axes, text, annotations, drawings, overlays, and crosshair.
  - WebGL2 for series and indicator geometry.
- Both backends consume the same immutable `ChartRenderModel`.
- `ChartOptions.renderer = "webgl2"` is an experimental opt-in. Canvas2D remains the
  default and is used automatically when WebGL2 initialization fails.

## 6. Migration policy

- No public API change is required for the backend seam.
- Canvas2D remains the default while WebGL2 proves parity across real workloads.
- If WebGL2 initialization fails, construction falls back to Canvas2D.
- Backend selection is exposed as an experimental creation-time option.
- The 1M-bar WebGL benchmark currently holds 60 fps with p95 around 33 ms on the local
  baseline; Canvas2D remains faster for fully aggregated views.

## 7. Acceptance criteria

- `Chart` no longer owns Canvas2D-specific renderer classes.
- Canvas2D behavior and visual snapshots remain unchanged.
- Text measurement no longer reaches through a public canvas context from `Chart`.
- A WebGL2 backend can implement the same interface without modifying `Chart`.
- Performance tests cover the target workload before WebGL becomes default.
