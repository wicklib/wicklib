import { fail } from "../errors";

export type Layer = "grid" | "series" | "extensions" | "drawings" | "overlay";

/**
 * Stacked canvases. Each layer is cleared and redrawn independently so the crosshair
 * never forces a full chart repaint.
 */
export class CanvasStack {
  readonly root: HTMLDivElement;

  private readonly canvases: Record<Layer, HTMLCanvasElement>;
  private readonly contexts: Record<Layer, CanvasRenderingContext2D>;
  private width = 0;
  private height = 0;
  private dpr = 1;

  constructor(container: HTMLElement) {
    const doc = container.ownerDocument;
    const root = doc.createElement("div");
    root.style.position = "relative";
    root.style.width = "100%";
    root.style.height = "100%";
    root.style.overflow = "hidden";
    root.style.userSelect = "none";
    root.style.cursor = "crosshair";

    const make = (layer: Layer): [HTMLCanvasElement, CanvasRenderingContext2D] => {
      const canvas = doc.createElement("canvas");
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.display = "block";
      canvas.style.pointerEvents = layer === "overlay" ? "auto" : "none";

      const context = canvas.getContext("2d");
      if (!context) {
        fail("INVALID_ARGUMENT", "Canvas 2D context is not available");
      }

      root.appendChild(canvas);
      return [canvas, context];
    };

    const [grid, gridContext] = make("grid");
    const [series, seriesContext] = make("series");
    const [extensions, extensionsContext] = make("extensions");
    const [drawings, drawingsContext] = make("drawings");
    const [overlay, overlayContext] = make("overlay");

    this.canvases = { grid, series, extensions, drawings, overlay };
    this.contexts = {
      grid: gridContext,
      series: seriesContext,
      extensions: extensionsContext,
      drawings: drawingsContext,
      overlay: overlayContext,
    };

    container.appendChild(root);
    this.root = root;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  getDpr(): number {
    return this.dpr;
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = Math.max(0, width);
    this.height = Math.max(0, height);
    this.dpr = Math.max(1, dpr);

    for (const layer of ["grid", "series", "extensions", "drawings", "overlay"] as const) {
      const canvas = this.canvases[layer];
      const context = this.contexts[layer];

      canvas.style.width = `${this.width}px`;
      canvas.style.height = `${this.height}px`;
      canvas.width = Math.max(1, Math.round(this.width * this.dpr));
      canvas.height = Math.max(1, Math.round(this.height * this.dpr));
      context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  }

  context(layer: Layer): CanvasRenderingContext2D {
    return this.contexts[layer];
  }

  /**
   * Composites every layer into a new canvas at the current backing-store resolution.
   */
  compose(): HTMLCanvasElement {
    const canvas = this.root.ownerDocument.createElement("canvas");
    canvas.width = this.canvases.grid.width;
    canvas.height = this.canvases.grid.height;
    const context = canvas.getContext("2d");
    if (!context) {
      fail("INVALID_ARGUMENT", "Canvas 2D context is not available");
    }
    for (const layer of ["grid", "series", "extensions", "drawings", "overlay"] as const) {
      context.drawImage(this.canvases[layer], 0, 0);
    }
    return canvas;
  }

  clear(layer: Layer): void {
    const context = this.contexts[layer];
    context.clearRect(0, 0, this.width, this.height);
  }

  destroy(): void {
    this.root.remove();
  }
}
