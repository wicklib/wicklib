import type { OhlcStore } from "../data/ohlc-store";
import type { IndicatorRenderData, IndicatorPlotRenderData } from "../indicator";
import type { PriceScale } from "../scale/price-scale";
import type { TimeScale } from "../scale/time-scale";
import { formatCrosshairTime, formatTimeLabel, generateTimeTicks } from "../scale/ticks";
import type { Point } from "../types";
import type { CanvasStack } from "./canvas-stack";

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

export interface PaneRenderModel {
  paneId: string;
  plot: PlotRect;
  priceScale: PriceScale;
  series: readonly SeriesRenderData[];
  indicators: readonly IndicatorRenderData[];
}

export interface CrosshairRenderPoint {
  paneId: string;
  point: Point;
}

export interface ChartRenderModel {
  width: number;
  height: number;
  panes: readonly PaneRenderModel[];
  timeScale: TimeScale;
  layout: ResolvedLayout;
  grid: ResolvedGrid;
  crosshair: ResolvedCrosshair;
  crosshairPoint: CrosshairRenderPoint | null;
  locale: string;
  timezone: string;
  timeVisible: boolean;
  secondsVisible: boolean;
  axisWidth: number;
  axisHeight: number;
}

const TIME_AXIS_HEIGHT = 28;

/**
 * Stateless drawing routines over the canvas stack.
 */
export class ChartRenderer {
  private readonly stack: CanvasStack;
  private readonly timeScale: TimeScale;

  constructor(stack: CanvasStack, timeScale: TimeScale) {
    this.stack = stack;
    this.timeScale = timeScale;
  }

  renderAll(model: ChartRenderModel): void {
    this.drawGrid(model);
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

    const visible = this.timeScale.getVisibleRange();
    const bottomPane = model.panes[model.panes.length - 1];
    if (!bottomPane) {
      return;
    }
    const timeTicks = generateTimeTicks(visible.from, visible.to, bottomPane.plot.width);
    const span = Math.max(0, visible.to - visible.from);

    context.font = this.font(model);

    for (const pane of model.panes) {
      const { plot, priceScale } = pane;
      if (plot.height <= 0 || plot.width <= 0) {
        continue;
      }

      context.save();
      context.beginPath();
      context.rect(plot.left, plot.top, plot.width, plot.height);
      context.clip();

      const priceTicks = priceScale.ticks(plot.height);

      if (model.grid.horzVisible) {
        context.strokeStyle = model.grid.horzColor;
        context.lineWidth = 1;
        context.beginPath();
        for (const tick of priceTicks) {
          const y = crisp(priceScale.priceToY(tick.value, plot.top, plot.height));
          if (y < plot.top || y > plot.bottom) {
            continue;
          }
          context.moveTo(plot.left, y);
          context.lineTo(plot.right, y);
        }
        context.stroke();
      }

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

      context.fillStyle = model.layout.textColor;
      context.textAlign = "left";
      context.textBaseline = "middle";

      let lastPriceY = Number.NEGATIVE_INFINITY;
      for (const tick of priceTicks) {
        const y = priceScale.priceToY(tick.value, plot.top, plot.height);
        if (y < plot.top - 1 || y > plot.bottom + 1) {
          continue;
        }
        if (Math.abs(y - lastPriceY) < model.layout.fontSize + 4) {
          continue;
        }
        lastPriceY = y;
        context.fillText(priceScale.formatValue(tick.value, model.locale), plot.right + 8, y);
      }

      if (priceScale.isBorderVisible()) {
        context.strokeStyle = model.grid.horzColor;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(crisp(plot.right), plot.top);
        context.lineTo(crisp(plot.right), plot.bottom);
        context.stroke();
      }

      context.strokeStyle = model.grid.vertColor;
      context.beginPath();
      context.moveTo(plot.left, crisp(plot.bottom));
      context.lineTo(plot.right, crisp(plot.bottom));
      context.stroke();
    }

    context.fillStyle = model.layout.textColor;
    context.strokeStyle = model.grid.vertColor;
    context.beginPath();
    context.moveTo(bottomPane.plot.left, crisp(bottomPane.plot.bottom));
    context.lineTo(bottomPane.plot.right, crisp(bottomPane.plot.bottom));
    context.stroke();

    context.textAlign = "center";
    let lastTimeX = Number.NEGATIVE_INFINITY;
    for (const time of timeTicks) {
      const x = this.timeScale.timeToX(time);
      if (x === null || x < bottomPane.plot.left + 20 || x > bottomPane.plot.right - 20) {
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
        bottomPane.plot.bottom + model.axisHeight / 2,
      );
    }
  }

  private drawSeries(model: ChartRenderModel): void {
    const context = this.stack.context("series");
    this.stack.clear("series");
    context.setTransform(this.stack.getDpr(), 0, 0, this.stack.getDpr(), 0, 0);

    const range = this.timeScale.visibleIndexRange();
    let rendered = false;

    for (const pane of model.panes) {
      if (pane.plot.height <= 0) {
        continue;
      }

      context.save();
      context.beginPath();
      context.rect(pane.plot.left, pane.plot.top, pane.plot.width, pane.plot.height);
      context.clip();

      for (const series of pane.series) {
        if (!series.visible || series.bars.length === 0 || range.last < range.first) {
          continue;
        }
        rendered = true;
        this.drawCandles(context, model, pane, series, range.first, range.last);
      }

      if (this.drawIndicatorPlots(context, model, pane, range.first, range.last)) {
        rendered = true;
      }

      context.restore();

      let legendOffset = 0;
      for (const series of pane.series) {
        if (!series.visible || series.bars.length === 0) {
          continue;
        }
        const lastIndex = Math.min(range.last, series.bars.length - 1);
        if (lastIndex < 0) {
          continue;
        }
        this.drawLastValue(context, model, pane, series, lastIndex);
        this.drawLegend(context, model, pane, series, lastIndex, legendOffset);
        legendOffset += model.layout.fontSize + 4;
      }

      for (const indicator of pane.indicators) {
        this.drawIndicatorLegend(context, model, pane, indicator, legendOffset);
        legendOffset += model.layout.fontSize + 4;
      }
    }

    if (!rendered && model.panes[0]) {
      const pane = model.panes[0];
      context.fillStyle = model.layout.textColor;
      context.globalAlpha = 0.5;
      context.font = this.font(model);
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        "No data",
        pane.plot.left + pane.plot.width / 2,
        pane.plot.top + pane.plot.height / 2,
      );
      context.globalAlpha = 1;
    }
  }

  private drawCandles(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    pane: PaneRenderModel,
    series: SeriesRenderData,
    first: number,
    last: number,
  ): void {
    const { plot } = pane;
    const spacing = this.timeScale.getBarSpacing();

    if (spacing < 1.5) {
      this.drawAggregatedCandles(context, model, pane, series, first, last);
      return;
    }

    const bodyWidth = Math.max(1, spacing * 0.7);
    const yOf = (price: number): number => pane.priceScale.priceToY(price, plot.top, plot.height);

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
    pane: PaneRenderModel,
    series: SeriesRenderData,
    first: number,
    last: number,
  ): void {
    const { plot } = pane;
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

      const yHigh = pane.priceScale.priceToY(high, plot.top, plot.height);
      const yLow = pane.priceScale.priceToY(low, plot.top, plot.height);
      const top = Math.min(yHigh, yLow);
      const height = Math.max(1, Math.abs(yLow - yHigh));

      context.fillStyle = close >= open ? series.upColor : series.downColor;
      context.fillRect(plot.left + column, top, 1, height);
    }
  }

  private drawIndicatorPlots(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    pane: PaneRenderModel,
    first: number,
    last: number,
  ): boolean {
    let drawn = false;

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
        drawn = true;

        if (plot.type === "histogram") {
          this.drawHistogramPlot(context, model, pane, plot, from, to);
        } else if (plot.type === "area") {
          this.drawAreaPlot(context, model, pane, plot, from, to);
        } else {
          this.drawLinePlot(context, model, pane, plot, from, to);
        }
      }
    }

    return drawn;
  }

  private drawLinePlot(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    pane: PaneRenderModel,
    plot: IndicatorPlotRenderData,
    first: number,
    last: number,
  ): void {
    const stride = plotStride(first, last, pane.plot.width);

    context.strokeStyle = plot.color;
    context.lineWidth = plot.lineWidth;
    context.setLineDash(dash(plot.lineStyle));
    context.beginPath();

    let started = false;
    for (let index = first; index <= last; index += stride) {
      const value = plot.values[index]!;
      if (Number.isNaN(value)) {
        started = false;
        continue;
      }
      const x = this.timeScale.indexToX(index);
      const y = pane.priceScale.priceToY(value, pane.plot.top, pane.plot.height);
      if (!started) {
        context.moveTo(x, y);
        started = true;
      } else {
        context.lineTo(x, y);
      }
    }

    context.stroke();
    context.setLineDash([]);
  }

  private drawAreaPlot(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    pane: PaneRenderModel,
    plot: IndicatorPlotRenderData,
    first: number,
    last: number,
  ): void {
    const stride = plotStride(first, last, pane.plot.width);
    const baselineY = pane.priceScale.priceToY(plot.baseline, pane.plot.top, pane.plot.height);
    const points: Array<{ x: number; y: number }> = [];

    const flush = (): void => {
      if (points.length === 0) {
        return;
      }

      context.beginPath();
      context.moveTo(points[0]!.x, baselineY);
      for (const point of points) {
        context.lineTo(point.x, point.y);
      }
      context.lineTo(points[points.length - 1]!.x, baselineY);
      context.closePath();
      context.globalAlpha = 0.12;
      context.fillStyle = plot.color;
      context.fill();
      context.globalAlpha = 1;

      context.beginPath();
      context.moveTo(points[0]!.x, points[0]!.y);
      for (let index = 1; index < points.length; index += 1) {
        context.lineTo(points[index]!.x, points[index]!.y);
      }
      context.strokeStyle = plot.color;
      context.lineWidth = plot.lineWidth;
      context.setLineDash(dash(plot.lineStyle));
      context.stroke();
      context.setLineDash([]);

      points.length = 0;
    };

    for (let index = first; index <= last; index += stride) {
      const value = plot.values[index]!;
      if (Number.isNaN(value)) {
        flush();
        continue;
      }
      points.push({
        x: this.timeScale.indexToX(index),
        y: pane.priceScale.priceToY(value, pane.plot.top, pane.plot.height),
      });
    }

    flush();
  }

  private drawHistogramPlot(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    pane: PaneRenderModel,
    plot: IndicatorPlotRenderData,
    first: number,
    last: number,
  ): void {
    const stride = plotStride(first, last, pane.plot.width);
    const zeroY = pane.priceScale.priceToY(plot.baseline, pane.plot.top, pane.plot.height);
    const width = Math.max(1, this.timeScale.getBarSpacing() * stride * 0.7);

    context.fillStyle = plot.color;

    for (let index = first; index <= last; index += stride) {
      const value = plot.values[index]!;
      if (Number.isNaN(value)) {
        continue;
      }
      const x = this.timeScale.indexToX(index);
      const y = pane.priceScale.priceToY(value, pane.plot.top, pane.plot.height);
      const top = Math.min(y, zeroY);
      const height = Math.max(1, Math.abs(zeroY - y));
      context.fillRect(x - width / 2, top, width, height);
    }
  }

  private drawLastValue(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    pane: PaneRenderModel,
    series: SeriesRenderData,
    lastIndex: number,
  ): void {
    const last = series.bars.barAt(lastIndex);
    const { plot } = pane;
    const y = pane.priceScale.priceToY(last.close, plot.top, plot.height);
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

    const label = pane.priceScale.formatValue(last.close, model.locale);
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
    pane: PaneRenderModel,
    series: SeriesRenderData,
    lastIndex: number,
    offset: number,
  ): void {
    if (!series.title) {
      return;
    }

    const last = series.bars.barAt(lastIndex);
    const { plot } = pane;
    const y = plot.top + model.layout.fontSize + offset;

    context.font = this.font(model);
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = model.layout.textColor;
    context.fillText(series.title, plot.left + 8, y);

    const label = ` ${pane.priceScale.formatValue(last.close, model.locale)}`;
    const width = context.measureText(series.title).width;
    context.fillStyle = last.close >= last.open ? series.upColor : series.downColor;
    context.fillText(label, plot.left + 8 + width, y);
  }

  private drawIndicatorLegend(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    pane: PaneRenderModel,
    indicator: IndicatorRenderData,
    offset: number,
  ): void {
    const plot = indicator.plots.find((candidate) => candidate.visible);
    if (!plot) {
      return;
    }

    const y = pane.plot.top + model.layout.fontSize + offset;
    context.font = this.font(model);
    context.textAlign = "left";
    context.textBaseline = "middle";

    context.fillStyle = plot.color;
    context.fillRect(pane.plot.left + 8, y - 3, 6, 6);

    context.fillStyle = model.layout.textColor;
    context.fillText(indicator.title, pane.plot.left + 20, y);
  }

  private drawOverlay(model: ChartRenderModel): void {
    const context = this.stack.context("overlay");
    this.stack.clear("overlay");
    context.setTransform(this.stack.getDpr(), 0, 0, this.stack.getDpr(), 0, 0);

    const crosshair = model.crosshairPoint;
    if (model.crosshair.mode === "hidden" || !crosshair) {
      return;
    }

    const hovered = model.panes.find((pane) => pane.paneId === crosshair.paneId);
    const firstPane = model.panes[0];
    const bottomPane = model.panes[model.panes.length - 1];
    if (!hovered || !firstPane || !bottomPane) {
      return;
    }

    const { x, y } = crosshair.point;
    if (
      x < hovered.plot.left ||
      x > hovered.plot.right ||
      y < hovered.plot.top ||
      y > hovered.plot.bottom
    ) {
      return;
    }

    context.save();

    if (model.crosshair.vertVisible) {
      context.strokeStyle = model.crosshair.vertColor;
      context.lineWidth = model.crosshair.vertWidth;
      context.setLineDash(dash(model.crosshair.vertStyle));
      context.beginPath();
      context.moveTo(crisp(x), firstPane.plot.top);
      context.lineTo(crisp(x), bottomPane.plot.bottom);
      context.stroke();
    }

    if (model.crosshair.horzVisible) {
      context.strokeStyle = model.crosshair.horzColor;
      context.lineWidth = model.crosshair.horzWidth;
      context.setLineDash(dash(model.crosshair.horzStyle));
      context.beginPath();
      context.moveTo(hovered.plot.left, crisp(y));
      context.lineTo(hovered.plot.right, crisp(y));
      context.stroke();
    }

    context.setLineDash([]);

    const price = hovered.priceScale.yToPrice(y, hovered.plot.top, hovered.plot.height);
    const priceLabel = hovered.priceScale.formatValue(price, model.locale);
    const boxHeight = model.layout.fontSize + 6;
    const priceTop = Math.max(
      hovered.plot.top,
      Math.min(hovered.plot.bottom - boxHeight, y - boxHeight / 2),
    );

    context.fillStyle = model.crosshair.labelBackground;
    context.fillRect(hovered.plot.right, priceTop, model.axisWidth, boxHeight);
    context.fillStyle = "#ffffff";
    context.font = this.font(model);
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(priceLabel, hovered.plot.right + 8, priceTop + boxHeight / 2);

    const time = this.timeScale.timeAtX(x);
    if (time !== null) {
      const label = formatCrosshairTime(time, model.locale, model.timezone, model.secondsVisible);
      const width = context.measureText(label).width + 16;
      const left = Math.max(
        bottomPane.plot.left,
        Math.min(bottomPane.plot.right - width, x - width / 2),
      );
      context.fillStyle = model.crosshair.labelBackground;
      context.fillRect(left, bottomPane.plot.bottom, width, model.axisHeight);
      context.fillStyle = "#ffffff";
      context.textAlign = "center";
      context.fillText(label, left + width / 2, bottomPane.plot.bottom + model.axisHeight / 2);
    }

    context.restore();
  }
}

function plotStride(first: number, last: number, width: number): number {
  const count = Math.max(1, last - first + 1);
  return Math.max(1, Math.ceil(count / Math.max(1, width)));
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
