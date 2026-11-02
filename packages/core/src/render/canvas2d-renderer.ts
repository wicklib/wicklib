import type { TimeScale } from "../scale/time-scale";
import type { RendererBackend } from "./backend";
import { ChartRenderer, type ChartRenderModel } from "./chart-renderer";
import { CanvasStack } from "./canvas-stack";

/**
 * Canvas2D renderer backend. Keeps all chart layers on 2D canvases.
 */
export class Canvas2DRenderer implements RendererBackend {
  readonly kind = "canvas2d" as const;

  private readonly stack: CanvasStack;
  private readonly renderer: ChartRenderer;

  constructor(container: HTMLElement, timeScale: TimeScale) {
    this.stack = new CanvasStack(container);
    this.renderer = new ChartRenderer(this.stack, timeScale);
  }

  get root(): HTMLElement {
    return this.stack.root;
  }

  getWidth(): number {
    return this.stack.getWidth();
  }

  getHeight(): number {
    return this.stack.getHeight();
  }

  resize(width: number, height: number, dpr: number): void {
    this.stack.resize(width, height, dpr);
  }

  render(model: ChartRenderModel): void {
    this.renderer.renderAll(model);
  }

  compose(): HTMLCanvasElement {
    return this.stack.compose();
  }

  measureText(text: string, font: string): number {
    const context = this.stack.context("grid");
    context.font = font;
    return context.measureText(text).width;
  }

  announce(message: string): void {
    this.stack.announce(message);
  }

  destroy(): void {
    this.stack.destroy();
  }
}
