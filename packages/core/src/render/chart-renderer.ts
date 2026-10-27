import type { OhlcStore } from "../data/ohlc-store";
import type { Point } from "../types";
import type { CanvasStack } from "./canvas-stack";
import type { PriceScale } from "../scale/price-scale";
import type { TimeScale } from "../scale/time-scale";
import { formatCrosshairTime, formatTimeLabel, generateTimeTicks } from "../scale/ticks";

export interface PlotRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ResolvedLayout {
  background: string;
  textColor: string;
  fontSize: number;
}

export interface ResolvedGrid {
  vertColor: string;
  vertVisible: boolean;
  horzColor: string;
  horzVisible: boolean;
}

export interface ResolvedCrosshair {
  mode: "normal" | "magnet" | "hidden";
  color: string;
  vertColor: string;
  horzColor: string;
  labelBackground: string;
  vertVisible: boolean;
  horzVisible: boolean;
  vertWidth: number;
  horzWidth: number;
  vertStyle: "solid" | "dotted" | "dashed";
  horzStyle: "solid" | "dotted" | "dashed";
}

export interface SeriesRenderData {
  bars: OhlcStore;
  visible: boolean;
  title: string;
  upColor: string;
  downColor: string;
  wickUpColor: string;
  wickDownColor: string;
  borderVisible: boolean;
  lastValueVisible: boolean;
  priceLineVisible: boolean;
}

export interface ChartRenderModel {
  width: number;
  height: number;
  plot: PlotRect;
  axisWidth: number;
  axisHeight: number;
  timeScale: TimeScale;
  priceScale: PriceScale;
  series: readonly SeriesRenderData[];
  layout: ResolvedLayout;
  grid: ResolvedGrid;
  crosshair: ResolvedCrosshair;
  crosshairPoint: Point | null;
  locale: string;
  timezone: string;
  timeVisible: boolean;
  secondsVisible: boolean;
}

const TIME_AXIS_HEIGHT = 28;

/**
 * Stateless drawing routines over the canvas stack.
 */
export class ChartRenderer {
  private readonly stack: CanvasStack;
  private readonly timeScale: TimeScale;
  private readonly priceScale: PriceScale;

  constructor(stack: CanvasStack, timeScale: TimeScale, priceScale: PriceScale) {
    this.stack = stack;
    this.timeScale = timeScale;
    this.priceScale = priceScale;
  }

  renderAll(model: ChartRenderModel): void {
    this.drawGrid(model);
    this.drawSeries(model);
    this.drawOverlay(model);
  }

  renderOverlay(model: ChartRenderModel): void {
    this.drawOverlay(model);
  }

  renderSeries(model: ChartRenderModel): void {
    this.drawSeries(model);
    this.drawOverlay(model);
  }

  private font(model: ChartRenderModel): string {
    return `${model.layout.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  }

  private drawGrid(model: ChartRenderModel): void {
    const context = this.stack.context("grid");
    this.stack.clear("grid");
    context.setTransform(this.stack.getDpr(), 0, 0, this.stack.getDpr(), 0, 0);

    context.fillStyle = model.layout.background;
    context.fillRect(0, 0, model.width, model.height);

    const { plot } = model;
    context.save();
    context.beginPath();
    context.rect(plot.left, plot.top, plot.width, plot.height);
    context.clip();

    const priceTicks = this.priceScale.ticks(plot.height);

    if (model.grid.horzVisible) {
      context.strokeStyle = model.grid.horzColor;
      context.lineWidth = 1;
      context.beginPath();
      for (const tick of priceTicks) {
        const y = crisp(this.priceScale.priceToY(tick.value, plot.top, plot.height));
        if (y < plot.top || y > plot.bottom) {
          continue;
        }
        context.moveTo(plot.left, y);
        context.lineTo(plot.right, y);
      }
      context.stroke();
    }

    const visible = this.timeScale.getVisibleRange();
    const timeTicks = generateTimeTicks(visible.from, visible.to, plot.width);

    if (model.grid.vertVisible) {
      context.strokeStyle = model.grid.vertColor;
      context.lineWidth = 1;
      context.beginPath();
      for (const time of timeTicks) {
        const x = this.timeScale.timeToX(time);
        if (x === null || x < plot.left || x > plot.right) {
          continue;
        }
        context.moveTo(crisp(x), plot.top);
        context.lineTo(crisp(x), plot.bottom);
      }
      context.stroke();
    }

    context.restore();

    context.font = this.font(model);
    context.fillStyle = model.layout.textColor;

    if (model.priceScale.isBorderVisible()) {
      context.strokeStyle = model.grid.horzColor;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(crisp(plot.right), plot.top);
      context.lineTo(crisp(plot.right), plot.bottom);
      context.stroke();
    }

    context.textAlign = "left";
    context.textBaseline = "middle";

    let lastPriceY = Number.NEGATIVE_INFINITY;
    for (const tick of priceTicks) {
      const y = this.priceScale.priceToY(tick.value, plot.top, plot.height);
      if (y < plot.top - 1 || y > plot.bottom + 1) {
        continue;
      }
      if (Math.abs(y - lastPriceY) < model.layout.fontSize + 4) {
        continue;
      }
      lastPriceY = y;
      context.fillText(this.priceScale.formatValue(tick.value, model.locale), plot.right + 8, y);
    }

    context.strokeStyle = model.grid.vertColor;
    context.beginPath();
    context.moveTo(plot.left, crisp(plot.bottom));
    context.lineTo(plot.right, crisp(plot.bottom));
    context.stroke();

    const span = Math.max(0, visible.to - visible.from);
    context.textAlign = "center";
    let lastTimeX = Number.NEGATIVE_INFINITY;

    for (const time of timeTicks) {
      const x = this.timeScale.timeToX(time);
      if (x === null || x < plot.left + 20 || x > plot.right - 20) {
        continue;
      }
      if (x - lastTimeX < 70) {
        continue;
      }
      lastTimeX = x;
      context.fillText(
        formatTimeLabel(
          time,
          span,
          model.locale,
          model.timezone,
          model.timeVisible,
          model.secondsVisible,
        ),
        x,
        plot.bottom + model.axisHeight / 2,
      );
    }
  }

  private drawSeries(model: ChartRenderModel): void {
    const context = this.stack.context("series");
    this.stack.clear("series");
    context.setTransform(this.stack.getDpr(), 0, 0, this.stack.getDpr(), 0, 0);

    const { plot } = model;
    const range = this.timeScale.visibleIndexRange();

    context.save();
    context.beginPath();
    context.rect(plot.left, plot.top, plot.width, plot.height);
    context.clip();

    let rendered = false;

    for (const series of model.series) {
      if (!series.visible || series.bars.length === 0 || range.last < range.first) {
        continue;
      }
      rendered = true;
      this.drawCandles(context, model, series, range.first, range.last);
    }

    context.restore();

    for (const series of model.series) {
      if (!series.visible || series.bars.length === 0) {
        continue;
      }
      const lastIndex = Math.min(range.last, series.bars.length - 1);
      if (lastIndex < 0) {
        continue;
      }
      this.drawLastValue(context, model, series, lastIndex);
      this.drawLegend(context, model, series, lastIndex);
    }

    if (!rendered) {
      context.fillStyle = model.layout.textColor;
      context.globalAlpha = 0.5;
      context.font = this.font(model);
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("No data", plot.left + plot.width / 2, plot.top + plot.height / 2);
      context.globalAlpha = 1;
    }
  }

  private drawCandles(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    series: SeriesRenderData,
    first: number,
    last: number,
  ): void {
    const { plot } = model;
    const spacing = this.timeScale.getBarSpacing();

    if (spacing < 1.5) {
      this.drawAggregatedCandles(context, model, series, first, last);
      return;
    }

    const bodyWidth = Math.max(1, spacing * 0.7);

    const yOf = (price: number): number => this.priceScale.priceToY(price, plot.top, plot.height);

    context.lineWidth = 1;

    for (const direction of ["up", "down"] as const) {
      context.strokeStyle = direction === "up" ? series.wickUpColor : series.wickDownColor;
      context.beginPath();

      for (let index = first; index <= last; index += 1) {
        const open = series.bars.openAt(index);
        const close = series.bars.closeAt(index);
        const isUp = close >= open;
        if ((direction === "up") !== isUp) {
          continue;
        }
        const x = crisp(this.timeScale.indexToX(index));
        context.moveTo(x, yOf(series.bars.highAt(index)));
        context.lineTo(x, yOf(series.bars.lowAt(index)));
      }

      context.stroke();
    }

    for (const direction of ["up", "down"] as const) {
      context.fillStyle = direction === "up" ? series.upColor : series.downColor;
      if (series.borderVisible) {
        context.strokeStyle = context.fillStyle;
      }

      for (let index = first; index <= last; index += 1) {
        const open = series.bars.openAt(index);
        const close = series.bars.closeAt(index);
        const isUp = close >= open;
        if ((direction === "up") !== isUp) {
          continue;
        }

        const x = this.timeScale.indexToX(index);
        const yOpen = yOf(open);
        const yClose = yOf(close);
        const top = Math.min(yOpen, yClose);
        const height = Math.max(1, Math.abs(yClose - yOpen));

        context.fillRect(x - bodyWidth / 2, top, bodyWidth, height);
        if (series.borderVisible) {
          context.strokeRect(x - bodyWidth / 2, top, bodyWidth, height);
        }
      }
    }
  }

  private drawAggregatedCandles(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    series: SeriesRenderData,
    first: number,
    last: number,
  ): void {
    const { plot } = model;
    const count = series.bars.length;
    const from = Math.max(0, first);
    const to = Math.min(count - 1, last);
    const columns = Math.ceil(plot.width);

    for (let column = 0; column < columns; column += 1) {
      const start = Math.max(from, Math.floor(this.timeScale.xToIndex(column)));
      const end = Math.min(to, Math.floor(this.timeScale.xToIndex(column + 1)));
      if (start > end) {
        continue;
      }

      const open = series.bars.openAt(start);
      const close = series.bars.closeAt(end);
      let high = series.bars.highAt(start);
      let low = series.bars.lowAt(start);

      for (let index = start + 1; index <= end; index += 1) {
        const nextHigh = series.bars.highAt(index);
        const nextLow = series.bars.lowAt(index);
        if (nextHigh > high) {
          high = nextHigh;
        }
        if (nextLow < low) {
          low = nextLow;
        }
      }

      const yHigh = this.priceScale.priceToY(high, plot.top, plot.height);
      const yLow = this.priceScale.priceToY(low, plot.top, plot.height);
      const top = Math.min(yHigh, yLow);
      const height = Math.max(1, Math.abs(yLow - yHigh));

      context.fillStyle = close >= open ? series.upColor : series.downColor;
      context.fillRect(plot.left + column, top, 1, height);
    }
  }

  private drawLastValue(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    series: SeriesRenderData,
    lastIndex: number,
  ): void {
    const last = series.bars.barAt(lastIndex);

    const { plot } = model;
    const y = this.priceScale.priceToY(last.close, plot.top, plot.height);
    if (y < plot.top || y > plot.bottom) {
      return;
    }

    const color = last.close >= last.open ? series.upColor : series.downColor;

    if (series.priceLineVisible) {
      context.save();
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.setLineDash([4, 4]);
      context.beginPath();
      context.moveTo(plot.left, crisp(y));
      context.lineTo(plot.right, crisp(y));
      context.stroke();
      context.restore();
    }

    if (!series.lastValueVisible) {
      return;
    }

    const label = this.priceScale.formatValue(last.close, model.locale);
    const boxHeight = model.layout.fontSize + 6;
    const top = Math.max(plot.top, Math.min(plot.bottom - boxHeight, y - boxHeight / 2));

    context.fillStyle = color;
    context.fillRect(plot.right, top, model.axisWidth, boxHeight);

    context.fillStyle = "#ffffff";
    context.font = this.font(model);
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(label, plot.right + 8, top + boxHeight / 2);
  }

  private drawLegend(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    series: SeriesRenderData,
    lastIndex: number,
  ): void {
    if (!series.title) {
      return;
    }

    const last = series.bars.barAt(lastIndex);
    const { plot } = model;
    const y = plot.top + model.layout.fontSize;

    context.font = this.font(model);
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = model.layout.textColor;
    context.fillText(series.title, plot.left + 8, y);

    if (last) {
      const label = ` ${this.priceScale.formatValue(last.close, model.locale)}`;
      const width = context.measureText(series.title).width;
      context.fillStyle = last.close >= last.open ? series.upColor : series.downColor;
      context.fillText(label, plot.left + 8 + width, y);
    }
  }

  private drawOverlay(model: ChartRenderModel): void {
    const context = this.stack.context("overlay");
    this.stack.clear("overlay");
    context.setTransform(this.stack.getDpr(), 0, 0, this.stack.getDpr(), 0, 0);

    const point = model.crosshairPoint;
    if (model.crosshair.mode === "hidden" || !point) {
      return;
    }

    const { plot } = model;
    if (
      point.x < plot.left ||
      point.x > plot.right ||
      point.y < plot.top ||
      point.y > plot.bottom
    ) {
      return;
    }

    context.save();

    if (model.crosshair.vertVisible) {
      context.strokeStyle = model.crosshair.vertColor;
      context.lineWidth = model.crosshair.vertWidth;
      context.setLineDash(dash(model.crosshair.vertStyle));
      context.beginPath();
      context.moveTo(crisp(point.x), plot.top);
      context.lineTo(crisp(point.x), plot.bottom);
      context.stroke();
    }

    if (model.crosshair.horzVisible) {
      context.strokeStyle = model.crosshair.horzColor;
      context.lineWidth = model.crosshair.horzWidth;
      context.setLineDash(dash(model.crosshair.horzStyle));
      context.beginPath();
      context.moveTo(plot.left, crisp(point.y));
      context.lineTo(plot.right, crisp(point.y));
      context.stroke();
    }

    context.setLineDash([]);

    const price = this.priceScale.yToPrice(point.y, plot.top, plot.height);
    const priceLabel = this.priceScale.formatValue(price, model.locale);
    const boxHeight = model.layout.fontSize + 6;
    const priceTop = Math.max(plot.top, Math.min(plot.bottom - boxHeight, point.y - boxHeight / 2));

    context.fillStyle = model.crosshair.labelBackground;
    context.fillRect(plot.right, priceTop, model.axisWidth, boxHeight);
    context.fillStyle = "#ffffff";
    context.font = this.font(model);
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(priceLabel, plot.right + 8, priceTop + boxHeight / 2);

    const time = this.timeScale.timeAtX(point.x);
    if (time !== null) {
      const label = formatCrosshairTime(time, model.locale, model.timezone, model.secondsVisible);
      const width = context.measureText(label).width + 16;
      const left = Math.max(plot.left, Math.min(plot.right - width, point.x - width / 2));
      context.fillStyle = model.crosshair.labelBackground;
      context.fillRect(left, plot.bottom, width, model.axisHeight);
      context.fillStyle = "#ffffff";
      context.textAlign = "center";
      context.fillText(label, left + width / 2, plot.bottom + model.axisHeight / 2);
    }

    context.restore();
  }
}

function crisp(value: number): number {
  return Math.round(value) + 0.5;
}

function dash(style: "solid" | "dotted" | "dashed"): number[] {
  if (style === "dotted") {
    return [2, 2];
  }
  if (style === "dashed") {
    return [5, 4];
  }
  return [];
}

export { TIME_AXIS_HEIGHT };
