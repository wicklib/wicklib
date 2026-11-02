import type { ChartRenderModel } from "./chart-renderer";

export type RendererBackendKind = "canvas2d" | "webgl2";

/**
 * Backend-neutral chart renderer contract.
 *
 * Implementations own their canvas layers but receive the same immutable render model.
 */
export interface RendererBackend {
  readonly kind: RendererBackendKind;
  readonly root: HTMLElement;
  getWidth(): number;
  getHeight(): number;
  resize(width: number, height: number, dpr: number): void;
  render(model: ChartRenderModel): void;
  compose(): HTMLCanvasElement;
  measureText(text: string, font: string): number;
  announce(message: string): void;
  destroy(): void;
}
