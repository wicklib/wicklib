import { fail } from "../errors";
import type { IndicatorPlotRenderData } from "../indicator";
import type { TimeScale } from "../scale/time-scale";
import type { RendererBackend } from "./backend";
import { CanvasStack } from "./canvas-stack";
import {
  ChartRenderer,
  type ChartRenderModel,
  type HistogramSeriesRenderData,
  type LineSeriesRenderData,
  type AreaSeriesRenderData,
  type PaneRenderModel,
  type SeriesRenderData,
} from "./chart-renderer";

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface PreparedLine {
  x: number;
  y: number;
}

const VERTEX_FLOATS = 6;
const LINE_DASH: Record<"dotted" | "dashed", [number, number]> = {
  dotted: [2, 2],
  dashed: [5, 4],
};

/**
 * Hybrid WebGL2 backend. Dense series geometry renders on a WebGL2 canvas while the grid,
 * axes, annotations, drawings, extensions, and crosshair remain crisp Canvas2D layers.
 */
export class WebGL2Renderer implements RendererBackend {
  readonly kind = "webgl2" as const;

  private readonly stack: CanvasStack;
  private readonly renderer: ChartRenderer;
  private readonly timeScale: TimeScale;
  private readonly glCanvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly buffer: WebGLBuffer;
  private readonly positionLocation: number;
  private readonly colorLocation: number;
  private readonly resolutionLocation: WebGLUniformLocation;
  private readonly colors = new Map<string, Rgba>();
  private width = 0;
  private height = 0;
  private dpr = 1;

  constructor(container: HTMLElement, timeScale: TimeScale) {
    this.timeScale = timeScale;

    const doc = container.ownerDocument;
    const canvas = doc.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.display = "block";
    canvas.style.pointerEvents = "none";
    this.glCanvas = canvas;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    if (!gl) {
      fail("INVALID_ARGUMENT", "WebGL2 is not available");
    }
    this.gl = gl;

    const vertex = compileShader(
      gl,
      gl.VERTEX_SHADER,
      `#version 300 es
      in vec2 a_position;
      in vec4 a_color;
      uniform vec2 u_resolution;
      out vec4 v_color;
      void main() {
        vec2 clip = vec2(
          (a_position.x / u_resolution.x) * 2.0 - 1.0,
          1.0 - (a_position.y / u_resolution.y) * 2.0
        );
        gl_Position = vec4(clip, 0.0, 1.0);
        v_color = a_color;
      }`,
    );
    const fragment = compileShader(
      gl,
      gl.FRAGMENT_SHADER,
      `#version 300 es
      precision mediump float;
      in vec4 v_color;
      out vec4 outColor;
      void main() {
        outColor = v_color;
      }`,
    );

    const program = gl.createProgram();
    if (!program) {
      fail("INVALID_ARGUMENT", "Could not create WebGL2 program");
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) ?? "WebGL2 program link failed";
      gl.deleteProgram(program);
      fail("INVALID_ARGUMENT", message);
    }
    this.program = program;

    this.stack = new CanvasStack(container);
    this.renderer = new ChartRenderer(this.stack, timeScale);
    this.stack.insertBefore("series", canvas);

    const buffer = gl.createBuffer();
    if (!buffer) {
      fail("INVALID_ARGUMENT", "Could not create WebGL2 buffer");
    }
    this.buffer = buffer;
    this.positionLocation = gl.getAttribLocation(program, "a_position");
    this.colorLocation = gl.getAttribLocation(program, "a_color");
    const resolution = gl.getUniformLocation(program, "u_resolution");
    if (!resolution) {
      fail("INVALID_ARGUMENT", "Could not resolve WebGL2 resolution uniform");
    }
    this.resolutionLocation = resolution;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, VERTEX_FLOATS * 4, 0);
    gl.enableVertexAttribArray(this.colorLocation);
    gl.vertexAttribPointer(this.colorLocation, 4, gl.FLOAT, false, VERTEX_FLOATS * 4, 2 * 4);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
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
    this.width = Math.max(0, width);
    this.height = Math.max(0, height);
    this.dpr = Math.max(1, dpr);
    this.stack.resize(width, height, dpr);
    this.glCanvas.style.width = `${this.width}px`;
    this.glCanvas.style.height = `${this.height}px`;
    this.glCanvas.width = Math.max(1, Math.round(this.width * this.dpr));
    this.glCanvas.height = Math.max(1, Math.round(this.height * this.dpr));
    this.gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
  }

  render(model: ChartRenderModel): void {
    this.renderer.renderChrome(model);
    this.renderer.renderSeriesAnnotations(model);
    this.renderGeometry(model);
  }

  compose(): HTMLCanvasElement {
    const doc = this.stack.root.ownerDocument;
    const canvas = doc.createElement("canvas");
    canvas.width = this.stack.canvas("grid").width;
    canvas.height = this.stack.canvas("grid").height;
    const context = canvas.getContext("2d");
    if (!context) {
      fail("INVALID_ARGUMENT", "Canvas 2D context is not available");
    }
    context.drawImage(this.stack.canvas("grid"), 0, 0);
    context.drawImage(this.glCanvas, 0, 0);
    for (const layer of ["series", "extensions", "drawings", "overlay"] as const) {
      context.drawImage(this.stack.canvas(layer), 0, 0);
    }
    return canvas;
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
    this.glCanvas.remove();
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteProgram(this.program);
    this.stack.destroy();
  }

  private renderGeometry(model: ChartRenderModel): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform2f(this.resolutionLocation, model.width, model.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

    const range = this.timeScale.visibleIndexRange();
    if (range.last < range.first) {
      return;
    }

    for (const pane of model.panes) {
      if (pane.plot.width <= 0 || pane.plot.height <= 0) {
        continue;
      }
      const vertices = this.buildPaneVertices(model, pane, range.first, range.last);
      if (vertices.length === 0) {
        continue;
      }
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(
        Math.floor(pane.plot.left * this.dpr),
        Math.floor((model.height - pane.plot.bottom) * this.dpr),
        Math.ceil(pane.plot.width * this.dpr),
        Math.ceil(pane.plot.height * this.dpr),
      );
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / VERTEX_FLOATS);
    }
    gl.disable(gl.SCISSOR_TEST);
  }

  private buildPaneVertices(
    model: ChartRenderModel,
    pane: PaneRenderModel,
    first: number,
    last: number,
  ): number[] {
    const vertices: number[] = [];
    const range = last - first + 1;
    const stride = Math.max(1, Math.ceil(range / Math.max(1, pane.plot.width)));

    for (const series of pane.series) {
      if (!series.visible || series.store.length === 0) {
        continue;
      }
      if (series.kind === "candlestick") {
        this.buildCandles(vertices, pane, series, first, last);
      } else if (series.kind === "line") {
        this.buildLine(vertices, pane, series, first, last, stride);
      } else if (series.kind === "area") {
        this.buildArea(vertices, pane, series, first, last, stride);
      } else {
        this.buildHistogram(vertices, pane, series, first, last, stride);
      }
    }

    for (const indicator of pane.indicators) {
      for (const plot of indicator.plots) {
        if (!plot.visible || plot.values.length === 0) {
          continue;
        }
        const to = Math.min(last, plot.values.length - 1);
        const from = Math.max(0, first);
        if (from > to) {
          continue;
        }
        if (plot.type === "histogram") {
          this.buildIndicatorHistogram(vertices, pane, plot, from, to, stride);
        } else if (plot.type === "area") {
          this.buildIndicatorArea(vertices, pane, plot, from, to, stride);
        } else {
          this.buildIndicatorLine(vertices, pane, plot, from, to, stride);
        }
      }
    }

    return vertices;
  }

  private buildCandles(
    vertices: number[],
    pane: PaneRenderModel,
    series: Extract<SeriesRenderData, { kind: "candlestick" }>,
    first: number,
    last: number,
  ): void {
    const spacing = this.timeScale.getBarSpacing();
    const from = Math.max(0, first);
    const to = Math.min(series.store.length - 1, last);
    if (from > to) {
      return;
    }

    if (spacing < 1.5) {
      this.buildAggregatedCandles(vertices, pane, series, from, to);
      return;
    }

    const bodyWidth = Math.max(1, spacing * 0.7);
    for (let index = from; index <= to; index += 1) {
      const x = this.timeScale.indexToX(index);
      const open = series.store.openAt(index);
      const close = series.store.closeAt(index);
      const up = close >= open;
      const color = this.rgba(up ? series.upColor : series.downColor);
      const wickColor = this.rgba(up ? series.wickUpColor : series.wickDownColor);
      const yHigh = this.priceY(pane, series.store.highAt(index));
      const yLow = this.priceY(pane, series.store.lowAt(index));
      const yOpen = this.priceY(pane, open);
      const yClose = this.priceY(pane, close);
      this.rect(vertices, x - 0.5, yHigh, 1, Math.max(1, yLow - yHigh), wickColor);
      const top = Math.min(yOpen, yClose);
      const height = Math.max(1, Math.abs(yClose - yOpen));
      this.rect(vertices, x - bodyWidth / 2, top, bodyWidth, height, color);
      if (series.borderVisible) {
        this.strokeRect(vertices, x - bodyWidth / 2, top, bodyWidth, height, color);
      }
    }
  }

  private buildAggregatedCandles(
    vertices: number[],
    pane: PaneRenderModel,
    series: Extract<SeriesRenderData, { kind: "candlestick" }>,
    first: number,
    last: number,
  ): void {
    const columns = Math.ceil(pane.plot.width);
    for (let column = 0; column < columns; column += 1) {
      if (this.timeScale.isGapX(column)) {
        continue;
      }
      const start = Math.max(first, Math.floor(this.timeScale.xToIndex(column)));
      const end = Math.min(last, Math.floor(this.timeScale.xToIndex(column + 1)));
      if (start > end || this.timeScale.hasGapBetween(start, end)) {
        continue;
      }
      let high = series.store.highAt(start);
      let low = series.store.lowAt(start);
      for (let index = start + 1; index <= end; index += 1) {
        high = Math.max(high, series.store.highAt(index));
        low = Math.min(low, series.store.lowAt(index));
      }
      const open = series.store.openAt(start);
      const close = series.store.closeAt(end);
      const top = this.priceY(pane, high);
      const bottom = this.priceY(pane, low);
      this.rect(
        vertices,
        pane.plot.left + column,
        Math.min(top, bottom),
        1,
        Math.max(1, Math.abs(bottom - top)),
        this.rgba(close >= open ? series.upColor : series.downColor),
      );
    }
  }

  private buildLine(
    vertices: number[],
    pane: PaneRenderModel,
    series: LineSeriesRenderData,
    first: number,
    last: number,
    stride: number,
  ): void {
    const points = this.linePoints(pane, first, last, stride, (index) =>
      series.store.valueAt(index),
    );
    this.linePath(vertices, points, series.color, series.lineWidth, series.lineStyle);
  }

  private buildArea(
    vertices: number[],
    pane: PaneRenderModel,
    series: AreaSeriesRenderData,
    first: number,
    last: number,
    stride: number,
  ): void {
    const points = this.linePoints(pane, first, last, stride, (index) =>
      series.store.valueAt(index),
    );
    const top = this.rgba(series.topColor);
    const bottom = this.rgba(series.bottomColor);
    for (let index = 1; index < points.length; index += 1) {
      const firstPoint = points[index - 1]!;
      const secondPoint = points[index]!;
      this.triangle(
        vertices,
        firstPoint.x,
        firstPoint.y,
        firstPoint.x,
        pane.plot.bottom,
        secondPoint.x,
        secondPoint.y,
        top,
        bottom,
        top,
      );
      this.triangle(
        vertices,
        firstPoint.x,
        pane.plot.bottom,
        secondPoint.x,
        pane.plot.bottom,
        secondPoint.x,
        secondPoint.y,
        bottom,
        bottom,
        top,
      );
    }
    this.linePath(vertices, points, series.color, series.lineWidth, series.lineStyle);
  }

  private buildHistogram(
    vertices: number[],
    pane: PaneRenderModel,
    series: HistogramSeriesRenderData,
    first: number,
    last: number,
    stride: number,
  ): void {
    const color = this.rgba(series.color);
    const base = this.priceY(pane, series.base);
    const width = Math.max(1, this.timeScale.getBarSpacing() * stride * 0.7);
    for (let index = first; index <= last; index += stride) {
      const x = this.timeScale.indexToX(index);
      const y = this.priceY(pane, series.store.valueAt(index));
      this.rect(
        vertices,
        x - width / 2,
        Math.min(y, base),
        width,
        Math.max(1, Math.abs(base - y)),
        color,
      );
    }
  }

  private buildIndicatorLine(
    vertices: number[],
    pane: PaneRenderModel,
    plot: IndicatorPlotRenderData,
    first: number,
    last: number,
    stride: number,
  ): void {
    const points = this.indicatorPoints(pane, plot, first, last, stride);
    this.linePath(vertices, points, plot.color, plot.lineWidth, plot.lineStyle);
  }

  private buildIndicatorArea(
    vertices: number[],
    pane: PaneRenderModel,
    plot: IndicatorPlotRenderData,
    first: number,
    last: number,
    stride: number,
  ): void {
    const points = this.indicatorPoints(pane, plot, first, last, stride);
    const baseline = this.priceY(pane, plot.baseline);
    const top = this.rgba(plot.color, 0.12);
    const bottom = this.rgba(plot.color, 0);
    for (let index = 1; index < points.length; index += 1) {
      const firstPoint = points[index - 1]!;
      const secondPoint = points[index]!;
      this.triangle(
        vertices,
        firstPoint.x,
        firstPoint.y,
        firstPoint.x,
        baseline,
        secondPoint.x,
        secondPoint.y,
        top,
        bottom,
        top,
      );
      this.triangle(
        vertices,
        firstPoint.x,
        baseline,
        secondPoint.x,
        baseline,
        secondPoint.x,
        secondPoint.y,
        bottom,
        bottom,
        top,
      );
    }
    this.linePath(vertices, points, plot.color, plot.lineWidth, plot.lineStyle);
  }

  private buildIndicatorHistogram(
    vertices: number[],
    pane: PaneRenderModel,
    plot: IndicatorPlotRenderData,
    first: number,
    last: number,
    stride: number,
  ): void {
    const color = this.rgba(plot.color);
    const base = this.priceY(pane, plot.baseline);
    const width = Math.max(1, this.timeScale.getBarSpacing() * stride * 0.7);
    for (let index = first; index <= last; index += stride) {
      const value = plot.values[index]!;
      if (Number.isNaN(value)) {
        continue;
      }
      const x = this.timeScale.indexToX(index);
      const y = this.priceY(pane, value);
      this.rect(
        vertices,
        x - width / 2,
        Math.min(y, base),
        width,
        Math.max(1, Math.abs(base - y)),
        color,
      );
    }
  }

  private linePoints(
    pane: PaneRenderModel,
    first: number,
    last: number,
    stride: number,
    valueAt: (index: number) => number,
  ): PreparedLine[] {
    const points: PreparedLine[] = [];
    for (let index = first; index <= last; index += stride) {
      points.push({
        x: this.timeScale.indexToX(index),
        y: this.priceY(pane, valueAt(index)),
      });
    }
    return points;
  }

  private indicatorPoints(
    pane: PaneRenderModel,
    plot: IndicatorPlotRenderData,
    first: number,
    last: number,
    stride: number,
  ): PreparedLine[] {
    const points: PreparedLine[] = [];
    for (let index = first; index <= last; index += stride) {
      const value = plot.values[index]!;
      if (Number.isNaN(value)) {
        continue;
      }
      points.push({ x: this.timeScale.indexToX(index), y: this.priceY(pane, value) });
    }
    return points;
  }

  private linePath(
    vertices: number[],
    points: readonly PreparedLine[],
    color: string,
    width: number,
    style: "solid" | "dotted" | "dashed",
  ): void {
    const rgba = this.rgba(color);
    for (let index = 1; index < points.length; index += 1) {
      this.lineSegment(
        vertices,
        points[index - 1]!,
        points[index]!,
        Math.max(1, width),
        style,
        rgba,
      );
    }
  }

  private lineSegment(
    vertices: number[],
    first: PreparedLine,
    second: PreparedLine,
    width: number,
    style: "solid" | "dotted" | "dashed",
    color: Rgba,
  ): void {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
      return;
    }
    const pattern = style === "solid" ? null : LINE_DASH[style];
    const draw = (start: number, end: number): void => {
      if (end <= start) {
        return;
      }
      const sx = first.x + (dx * start) / length;
      const sy = first.y + (dy * start) / length;
      const ex = first.x + (dx * end) / length;
      const ey = first.y + (dy * end) / length;
      const nx = (-dy / length) * (width / 2);
      const ny = (dx / length) * (width / 2);
      this.quad(
        vertices,
        sx + nx,
        sy + ny,
        sx - nx,
        sy - ny,
        ex - nx,
        ey - ny,
        ex + nx,
        ey + ny,
        color,
      );
    };

    if (!pattern) {
      draw(0, length);
      return;
    }
    const [on, off] = pattern;
    let cursor = 0;
    while (cursor < length) {
      draw(cursor, Math.min(length, cursor + on));
      cursor += on + off;
    }
  }

  private priceY(pane: PaneRenderModel, value: number): number {
    return pane.priceScale.priceToY(value, pane.plot.top, pane.plot.height);
  }

  private rect(
    vertices: number[],
    x: number,
    y: number,
    width: number,
    height: number,
    color: Rgba,
  ): void {
    const right = x + width;
    const bottom = y + height;
    this.triangle(vertices, x, y, x, bottom, right, y, color, color, color);
    this.triangle(vertices, right, y, x, bottom, right, bottom, color, color, color);
  }

  private strokeRect(
    vertices: number[],
    x: number,
    y: number,
    width: number,
    height: number,
    color: Rgba,
  ): void {
    this.rect(vertices, x, y, width, 1, color);
    this.rect(vertices, x, y + height - 1, width, 1, color);
    this.rect(vertices, x, y, 1, height, color);
    this.rect(vertices, x + width - 1, y, 1, height, color);
  }

  private quad(
    vertices: number[],
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    dx: number,
    dy: number,
    color: Rgba,
  ): void {
    this.triangle(vertices, ax, ay, bx, by, cx, cy, color, color, color);
    this.triangle(vertices, ax, ay, cx, cy, dx, dy, color, color, color);
  }

  private triangle(
    vertices: number[],
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    ac: Rgba,
    bc: Rgba,
    cc: Rgba,
  ): void {
    vertices.push(ax, ay, ac.r, ac.g, ac.b, ac.a);
    vertices.push(bx, by, bc.r, bc.g, bc.b, bc.a);
    vertices.push(cx, cy, cc.r, cc.g, cc.b, cc.a);
  }

  private rgba(color: string, alpha = 1): Rgba {
    const key = `${color}:${alpha}`;
    const cached = this.colors.get(key);
    if (cached) {
      return cached;
    }
    const context = this.stack.context("grid");
    context.fillStyle = "#000000";
    context.fillStyle = color;
    const normalized = context.fillStyle as string;
    let rgba: Rgba;
    if (normalized.startsWith("#")) {
      const value = normalized.slice(1);
      const full =
        value.length === 3
          ? value
              .split("")
              .map((part) => `${part}${part}`)
              .join("")
          : value;
      rgba = {
        r: parseInt(full.slice(0, 2), 16) / 255,
        g: parseInt(full.slice(2, 4), 16) / 255,
        b: parseInt(full.slice(4, 6), 16) / 255,
        a: alpha,
      };
    } else {
      const match = normalized.match(/rgba?\(([^)]+)\)/);
      const parts = match?.[1]?.split(",").map((part) => part.trim()) ?? [];
      rgba = {
        r: Number(parts[0] ?? 255) / 255,
        g: Number(parts[1] ?? 255) / 255,
        b: Number(parts[2] ?? 255) / 255,
        a: Number(parts[3] ?? 1) * alpha,
      };
    }
    this.colors.set(key, rgba);
    return rgba;
  }
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    fail("INVALID_ARGUMENT", "Could not create WebGL2 shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "WebGL2 shader compilation failed";
    gl.deleteShader(shader);
    fail("INVALID_ARGUMENT", message);
  }
  return shader;
}
