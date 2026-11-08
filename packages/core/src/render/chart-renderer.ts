import type { LineStore } from "../data/line-store";
import type { OhlcStore } from "../data/ohlc-store";
import type { SeriesDataStore } from "../data/series-store";
import {
  anchorPoints,
  clipLineToRect,
  FIB_EXTENSION_LEVELS,
  FIB_LEVELS,
  disjointChannelGeometry,
  elliottLabelPlacement,
  fibTimeZoneValues,
  flatChannelLines,
  gannFanLines,
  parallelLines,
  pitchforkLines,
  pointOnLine,
  speedLineLines,
  type ResolvedDrawingOptions,
} from "../drawings";
import type { IndicatorRenderData, IndicatorPlotRenderData } from "../indicator";
import type { PriceScale } from "../scale/price-scale";
import type { TimeScale } from "../scale/time-scale";
import { formatCrosshairTime, formatTimeLabel } from "../scale/ticks";
import type {
  ChartOverlay,
  DrawingAnchor,
  LastValueMode,
  OverlayRenderFrame,
  Point,
  PriceLineOptions,
  SeriesMarker,
} from "../types";
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
  axisLineColor?: string;
  axisTextColor: string;
  axisFontSize: number;
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
  labelBackground?: string;
  vertVisible: boolean;
  horzVisible: boolean;
  vertWidth: number;
  horzWidth: number;
  vertStyle: "solid" | "dotted" | "dashed";
  horzStyle: "solid" | "dotted" | "dashed";
}

export type PriceLineRenderData = Required<PriceLineOptions>;

interface SeriesRenderBase {
  store: SeriesDataStore;
  visible: boolean;
  title: string;
  lastValueVisible: boolean;
  lastValueMode: LastValueMode;
  priceLineVisible: boolean;
  priceLines: readonly PriceLineRenderData[];
  markers: readonly SeriesMarker[];
}

export interface CandlestickSeriesRenderData extends SeriesRenderBase {
  kind: "candlestick";
  store: OhlcStore;
  upColor: string;
  downColor: string;
  wickUpColor: string;
  wickDownColor: string;
  borderVisible: boolean;
}

export interface LineSeriesRenderData extends SeriesRenderBase {
  kind: "line";
  store: LineStore;
  color: string;
  lineWidth: number;
  lineStyle: "solid" | "dotted" | "dashed";
}

export interface AreaSeriesRenderData extends SeriesRenderBase {
  kind: "area";
  store: LineStore;
  color: string;
  lineWidth: number;
  lineStyle: "solid" | "dotted" | "dashed";
  topColor: string;
  bottomColor: string;
}

export interface HistogramSeriesRenderData extends SeriesRenderBase {
  kind: "histogram";
  store: LineStore;
  color: string;
  base: number;
}

export type SeriesRenderData =
  | CandlestickSeriesRenderData
  | LineSeriesRenderData
  | AreaSeriesRenderData
  | HistogramSeriesRenderData;

export interface DrawingRenderData {
  id: string;
  toolId: string;
  paneId: string;
  anchors: readonly DrawingAnchor[];
  anchorCount: number;
  previewPoint: Point | null;
  options: ResolvedDrawingOptions;
  selected: boolean;
  preview: boolean;
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

export interface SelectionBoxRenderData {
  start: Point;
  current: Point;
}

export interface OverlayRenderData {
  id: string;
  paneId: string;
  overlay: ChartOverlay;
}

export interface ChartRenderModel {
  width: number;
  height: number;
  panes: readonly PaneRenderModel[];
  overlays: readonly OverlayRenderData[];
  drawings: readonly DrawingRenderData[];
  timeScale: TimeScale;
  layout: ResolvedLayout;
  grid: ResolvedGrid;
  crosshair: ResolvedCrosshair;
  crosshairPoint: CrosshairRenderPoint | null;
  selectionBox: SelectionBoxRenderData | null;
  locale: string;
  timezone: string;
  timeVisible: boolean;
  secondsVisible: boolean;
  axisWidth: number;
  axisHeight: number;
}

export function timeAxisHeight(axisFontSize: number): number {
  return Math.max(24, Math.ceil(axisFontSize + 16));
}

const ELLIOTT_LABELS: Readonly<Record<string, readonly string[]>> = {
  "elliott-impulse": ["0", "1", "2", "3", "4", "5"],
  "elliott-correction": ["0", "A", "B", "C"],
  "elliott-triangle": ["0", "A", "B", "C", "D", "E"],
  "elliott-double-combo": ["0", "W", "X", "Y"],
  "elliott-triple-combo": ["0", "W", "X", "Y", "X", "Z"],
};

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
    this.drawExtensions(model);
    this.drawDrawings(model);
    this.drawOverlay(model);
  }

  /**
   * Renders everything except series/indicator geometry and annotations.
   */
  renderChrome(model: ChartRenderModel): void {
    this.drawGrid(model);
    this.drawExtensions(model);
    this.drawDrawings(model);
    this.drawOverlay(model);
  }

  /**
   * Renders 2D series overlays: markers, price lines, last values, legends, and empty state.
   */
  renderSeriesAnnotations(model: ChartRenderModel): void {
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
        if (series.visible && series.markers.length > 0) {
          this.drawMarkers(context, model, pane, series, range.first, range.last);
          rendered = true;
        }
      }
      context.restore();

      let legendOffset = 0;
      for (const series of pane.series) {
        if (!series.visible || series.store.length === 0) {
          continue;
        }
        rendered = true;
        const lastIndex = Math.min(range.last, series.store.length - 1);
        if (lastIndex < 0) {
          continue;
        }
        this.drawPriceLines(context, model, pane, series);
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

  private font(model: ChartRenderModel, size = model.layout.fontSize): string {
    return `${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  }

  private axisFont(model: ChartRenderModel): string {
    return this.font(model, model.layout.axisFontSize);
  }

  private drawGrid(model: ChartRenderModel): void {
    const context = this.stack.context("grid");
    this.stack.clear("grid");
    context.setTransform(this.stack.getDpr(), 0, 0, this.stack.getDpr(), 0, 0);

    context.fillStyle = model.layout.background;
    context.fillRect(0, 0, model.width, model.height);

    const visible = this.timeScale.getVisibleTimeRange();
    const bottomPane = model.panes[model.panes.length - 1];
    if (!bottomPane) {
      return;
    }
    const timeTicks = this.timeScale.getTimeTicks(bottomPane.plot.width);
    const span = Math.max(0, visible.to - visible.from);
    const labelTimezone = this.timeScale.getCalendarTimezone() ?? model.timezone;

    context.font = this.axisFont(model);

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

      context.fillStyle = model.layout.axisTextColor;
      context.font = this.axisFont(model);
      context.textAlign = "left";
      context.textBaseline = "middle";

      let lastPriceY = Number.NEGATIVE_INFINITY;
      for (const tick of priceTicks) {
        const y = priceScale.priceToY(tick.value, plot.top, plot.height);
        if (y < plot.top - 1 || y > plot.bottom + 1) {
          continue;
        }
        if (Math.abs(y - lastPriceY) < model.layout.axisFontSize + 4) {
          continue;
        }
        lastPriceY = y;
        context.fillText(priceScale.formatValue(tick.value, model.locale), plot.right + 8, y);
      }

      if (priceScale.isBorderVisible()) {
        context.strokeStyle = model.layout.axisLineColor ?? model.grid.horzColor;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(crisp(plot.right), plot.top);
        context.lineTo(crisp(plot.right), plot.bottom);
        context.stroke();
      }

      if (this.timeScale.getOptions().borderVisible) {
        context.strokeStyle = model.layout.axisLineColor ?? model.grid.vertColor;
        context.beginPath();
        context.moveTo(plot.left, crisp(plot.bottom));
        context.lineTo(plot.right, crisp(plot.bottom));
        context.stroke();
      }
    }

    context.fillStyle = model.layout.axisTextColor;
    context.font = this.axisFont(model);
    context.strokeStyle = model.layout.axisLineColor ?? model.grid.vertColor;
    if (this.timeScale.getOptions().borderVisible) {
      context.beginPath();
      context.moveTo(bottomPane.plot.left, crisp(bottomPane.plot.bottom));
      context.lineTo(bottomPane.plot.right, crisp(bottomPane.plot.bottom));
      context.stroke();
    }

    context.textAlign = "center";
    const timeLabelGap = Math.max(70, Math.ceil(model.layout.axisFontSize * 5.5));
    let lastTimeX = Number.NEGATIVE_INFINITY;
    for (const time of timeTicks) {
      const x = this.timeScale.timeToX(time);
      if (x === null || x < bottomPane.plot.left + 20 || x > bottomPane.plot.right - 20) {
        continue;
      }
      if (x - lastTimeX < timeLabelGap) {
        continue;
      }
      lastTimeX = x;
      context.fillText(
        formatTimeLabel(
          time,
          span,
          model.locale,
          labelTimezone,
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
        if (!series.visible || series.store.length === 0 || range.last < range.first) {
          continue;
        }
        rendered = true;
        if (series.kind === "candlestick") {
          this.drawCandles(context, model, pane, series, range.first, range.last);
        } else if (series.kind === "line") {
          this.drawLineSeries(context, pane, series, range.first, range.last);
        } else if (series.kind === "area") {
          this.drawAreaSeries(context, pane, series, range.first, range.last);
        } else {
          this.drawHistogramSeries(context, pane, series, range.first, range.last);
        }
      }

      if (this.drawIndicatorPlots(context, model, pane, range.first, range.last)) {
        rendered = true;
      }

      for (const series of pane.series) {
        if (series.visible && series.markers.length > 0) {
          this.drawMarkers(context, model, pane, series, range.first, range.last);
          rendered = true;
        }
      }

      context.restore();

      let legendOffset = 0;
      for (const series of pane.series) {
        if (!series.visible || series.store.length === 0) {
          continue;
        }
        const lastIndex = Math.min(range.last, series.store.length - 1);
        if (lastIndex < 0) {
          continue;
        }
        this.drawPriceLines(context, model, pane, series);
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
    series: CandlestickSeriesRenderData,
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
        const open = series.store.openAt(index);
        const close = series.store.closeAt(index);
        const isUp = close >= open;
        if ((direction === "up") !== isUp) {
          continue;
        }
        const x = crisp(this.timeScale.indexToX(index));
        context.moveTo(x, yOf(series.store.highAt(index)));
        context.lineTo(x, yOf(series.store.lowAt(index)));
      }

      context.stroke();
    }

    for (const direction of ["up", "down"] as const) {
      context.fillStyle = direction === "up" ? series.upColor : series.downColor;
      if (series.borderVisible) {
        context.strokeStyle = context.fillStyle;
      }

      for (let index = first; index <= last; index += 1) {
        const open = series.store.openAt(index);
        const close = series.store.closeAt(index);
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
    series: CandlestickSeriesRenderData,
    first: number,
    last: number,
  ): void {
    const { plot } = pane;
    const count = series.store.length;
    const from = Math.max(0, first);
    const to = Math.min(count - 1, last);
    const columns = Math.ceil(plot.width);

    for (let column = 0; column < columns; column += 1) {
      if (this.timeScale.isGapX(column)) {
        continue;
      }
      const start = Math.max(from, Math.floor(this.timeScale.xToIndex(column)));
      const end = Math.min(to, Math.floor(this.timeScale.xToIndex(column + 1)));
      if (start > end || this.timeScale.hasGapBetween(start, end)) {
        continue;
      }

      const open = series.store.openAt(start);
      const close = series.store.closeAt(end);
      let high = series.store.highAt(start);
      let low = series.store.lowAt(start);

      for (let index = start + 1; index <= end; index += 1) {
        const nextHigh = series.store.highAt(index);
        const nextLow = series.store.lowAt(index);
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

  private drawLineSeries(
    context: CanvasRenderingContext2D,
    pane: PaneRenderModel,
    series: LineSeriesRenderData,
    first: number,
    last: number,
  ): void {
    const stride = plotStride(first, last, pane.plot.width);
    context.strokeStyle = series.color;
    context.lineWidth = series.lineWidth;
    context.setLineDash(dash(series.lineStyle));
    context.beginPath();

    let started = false;
    for (let index = first; index <= last; index += stride) {
      const x = this.timeScale.indexToX(index);
      const y = pane.priceScale.priceToY(
        series.store.valueAt(index),
        pane.plot.top,
        pane.plot.height,
      );
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

  private drawAreaSeries(
    context: CanvasRenderingContext2D,
    pane: PaneRenderModel,
    series: AreaSeriesRenderData,
    first: number,
    last: number,
  ): void {
    const stride = plotStride(first, last, pane.plot.width);
    const points: Array<{ x: number; y: number }> = [];
    for (let index = first; index <= last; index += stride) {
      points.push({
        x: this.timeScale.indexToX(index),
        y: pane.priceScale.priceToY(series.store.valueAt(index), pane.plot.top, pane.plot.height),
      });
    }
    if (points.length === 0) {
      return;
    }

    const gradient = context.createLinearGradient(0, pane.plot.top, 0, pane.plot.bottom);
    gradient.addColorStop(0, series.topColor);
    gradient.addColorStop(1, series.bottomColor);
    context.beginPath();
    context.moveTo(points[0]!.x, pane.plot.bottom);
    for (const point of points) {
      context.lineTo(point.x, point.y);
    }
    context.lineTo(points[points.length - 1]!.x, pane.plot.bottom);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();

    context.beginPath();
    context.moveTo(points[0]!.x, points[0]!.y);
    for (let index = 1; index < points.length; index += 1) {
      context.lineTo(points[index]!.x, points[index]!.y);
    }
    context.strokeStyle = series.color;
    context.lineWidth = series.lineWidth;
    context.setLineDash(dash(series.lineStyle));
    context.stroke();
    context.setLineDash([]);
  }

  private drawHistogramSeries(
    context: CanvasRenderingContext2D,
    pane: PaneRenderModel,
    series: HistogramSeriesRenderData,
    first: number,
    last: number,
  ): void {
    const stride = plotStride(first, last, pane.plot.width);
    const baseY = pane.priceScale.priceToY(series.base, pane.plot.top, pane.plot.height);
    const width = Math.max(1, this.timeScale.getBarSpacing() * stride * 0.7);
    context.fillStyle = series.color;

    for (let index = first; index <= last; index += stride) {
      const x = this.timeScale.indexToX(index);
      const y = pane.priceScale.priceToY(
        series.store.valueAt(index),
        pane.plot.top,
        pane.plot.height,
      );
      const top = Math.min(y, baseY);
      const height = Math.max(1, Math.abs(baseY - y));
      context.fillRect(x - width / 2, top, width, height);
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

  private drawPriceLines(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    pane: PaneRenderModel,
    series: SeriesRenderData,
  ): void {
    const { plot } = pane;

    for (const line of series.priceLines) {
      const y = pane.priceScale.priceToY(line.price, plot.top, plot.height);
      if (y < plot.top || y > plot.bottom) {
        continue;
      }

      if (line.lineVisible) {
        context.save();
        context.strokeStyle = line.color;
        context.lineWidth = line.lineWidth;
        context.setLineDash(dash(line.lineStyle));
        context.beginPath();
        context.moveTo(plot.left, crisp(y));
        context.lineTo(plot.right, crisp(y));
        context.stroke();
        context.restore();
      }

      const value = pane.priceScale.formatValue(line.price, model.locale);
      if (line.axisLabelVisible) {
        const boxHeight = model.layout.axisFontSize + 6;
        const top = Math.max(plot.top, Math.min(plot.bottom - boxHeight, y - boxHeight / 2));
        const label =
          line.title && line.titlePosition === "axis" ? `${line.title} ${value}` : value;
        context.font = this.axisFont(model);
        context.textBaseline = "middle";
        context.fillStyle = line.color;
        context.fillRect(plot.right, top, model.axisWidth, boxHeight);
        context.fillStyle = model.layout.axisTextColor;
        context.textAlign = "left";
        context.fillText(label, plot.right + 8, top + boxHeight / 2);
      }

      if (!line.title || line.titlePosition !== "plot") {
        continue;
      }

      const boxHeight = model.layout.fontSize + 6;
      const top = Math.max(plot.top, Math.min(plot.bottom - boxHeight, y - boxHeight / 2));
      const paddingX = 5;
      context.font = this.font(model);
      context.textBaseline = "middle";
      const boxWidth = context.measureText(line.title).width + paddingX * 2;
      const left = Math.max(plot.left + 2, plot.right - boxWidth - 2);
      context.fillStyle = line.color;
      context.fillRect(left, top, boxWidth, boxHeight);
      context.fillStyle = "#ffffff";
      context.textAlign = "left";
      context.fillText(line.title, left + paddingX, top + boxHeight / 2);
    }
  }

  private drawMarkers(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    pane: PaneRenderModel,
    series: SeriesRenderData,
    first: number,
    last: number,
  ): void {
    const { plot } = pane;
    const yOf = (price: number): number => pane.priceScale.priceToY(price, plot.top, plot.height);
    context.font = `11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";

    for (const marker of series.markers) {
      const index = series.store.nearestIndex(marker.time);
      if (index < first || index > last) {
        continue;
      }

      const x = this.timeScale.indexToX(index);
      const size = marker.size ?? 1;
      const radius = 5 * size;
      let y: number;
      let textAbove = true;

      if (marker.position === "aboveBar" || marker.position === "belowBar") {
        const value =
          series.kind === "candlestick"
            ? marker.position === "aboveBar"
              ? series.store.highAt(index)
              : series.store.lowAt(index)
            : series.store.valueAt(index);
        y = yOf(value) + (marker.position === "aboveBar" ? -radius - 3 : radius + 3);
        textAbove = marker.position === "aboveBar";
      } else if (marker.position === "inBar") {
        y = yOf(
          series.kind === "candlestick"
            ? (series.store.openAt(index) + series.store.closeAt(index)) / 2
            : series.store.valueAt(index),
        );
      } else if (marker.position === "atPriceTop") {
        y = yOf(marker.price!) - radius - 3;
      } else if (marker.position === "atPriceBottom") {
        y = yOf(marker.price!) + radius + 3;
        textAbove = false;
      } else {
        y = yOf(marker.price!);
      }

      const color = marker.color ?? "#2196f3";
      context.fillStyle = color;
      context.strokeStyle = color;
      const shape = marker.shape ?? "circle";

      if (shape === "circle") {
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      } else if (shape === "square") {
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      } else {
        const direction = shape === "arrowUp" ? -1 : 1;
        const tip = y + direction * radius * 1.4;
        const base = y - direction * radius;
        context.beginPath();
        context.moveTo(x, tip);
        context.lineTo(x - radius, base);
        context.lineTo(x + radius, base);
        context.closePath();
        context.fill();
      }

      if (!marker.text) {
        continue;
      }
      const textY = textAbove ? y - radius - 8 : y + radius + 8;
      context.fillStyle = color;
      context.fillText(marker.text, x, textY);
    }

    context.textAlign = "left";
    context.textBaseline = "alphabetic";
  }

  private drawLastValue(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    pane: PaneRenderModel,
    series: SeriesRenderData,
    visibleIndex: number,
  ): void {
    const { plot } = pane;
    const visibleValue = series.store.valueAt(visibleIndex);
    const visibleY = pane.priceScale.priceToY(visibleValue, plot.top, plot.height);

    if (series.priceLineVisible && visibleY >= plot.top && visibleY <= plot.bottom) {
      context.save();
      context.strokeStyle = this.seriesColor(series, visibleIndex);
      context.lineWidth = 1;
      context.setLineDash([4, 4]);
      context.beginPath();
      context.moveTo(plot.left, crisp(visibleY));
      context.lineTo(plot.right, crisp(visibleY));
      context.stroke();
      context.restore();
    }

    if (!series.lastValueVisible) {
      return;
    }

    const dataIndex = series.store.length - 1;
    const mode = series.lastValueMode;
    let visibleTop: number | null = null;

    if (mode === "visible" || mode === "both" || dataIndex === visibleIndex) {
      visibleTop = this.drawLastValueLabel(context, model, pane, series, visibleIndex, false, null);
    }

    if ((mode === "data" || mode === "both") && dataIndex !== visibleIndex) {
      this.drawLastValueLabel(context, model, pane, series, dataIndex, true, visibleTop);
    }
  }

  private drawLastValueLabel(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    pane: PaneRenderModel,
    series: SeriesRenderData,
    index: number,
    clamp: boolean,
    avoidTop: number | null,
  ): number | null {
    const { plot } = pane;
    const value = series.store.valueAt(index);
    const y = pane.priceScale.priceToY(value, plot.top, plot.height);
    const boxHeight = model.layout.axisFontSize + 6;
    let top = y - boxHeight / 2;
    let marker = "";

    if (top < plot.top || top + boxHeight > plot.bottom) {
      if (!clamp) {
        return null;
      }
      marker = top < plot.top ? "▲ " : "▼ ";
      top = top < plot.top ? plot.top : plot.bottom - boxHeight;
    }

    top = Math.max(plot.top, Math.min(plot.bottom - boxHeight, top));

    if (avoidTop !== null && Math.abs(top - avoidTop) < boxHeight) {
      const above = avoidTop - boxHeight - 2;
      const below = avoidTop + boxHeight + 2;
      if (top <= avoidTop && above >= plot.top) {
        top = above;
      } else if (below <= plot.bottom - boxHeight) {
        top = below;
      } else {
        top = Math.max(plot.top, above);
      }
    }

    const label = `${marker}${pane.priceScale.formatValue(value, model.locale)}`;
    context.fillStyle = this.seriesColor(series, index);
    context.fillRect(plot.right, top, model.axisWidth, boxHeight);

    context.fillStyle = model.layout.axisTextColor;
    context.font = this.axisFont(model);
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(label, plot.right + 8, top + boxHeight / 2);
    return top;
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

    const value = series.store.valueAt(lastIndex);
    const { plot } = pane;
    const y = plot.top + model.layout.fontSize + offset;

    context.font = this.font(model);
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = model.layout.textColor;
    context.fillText(series.title, plot.left + 8, y);

    const label = ` ${pane.priceScale.formatValue(value, model.locale)}`;
    const width = context.measureText(series.title).width;
    context.fillStyle = this.seriesColor(series, lastIndex);
    context.fillText(label, plot.left + 8 + width, y);
  }

  private seriesColor(series: SeriesRenderData, index: number): string {
    if (series.kind === "candlestick") {
      return series.store.closeAt(index) >= series.store.openAt(index)
        ? series.upColor
        : series.downColor;
    }
    return series.color;
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

  private drawExtensions(model: ChartRenderModel): void {
    const context = this.stack.context("extensions");
    this.stack.clear("extensions");
    context.setTransform(this.stack.getDpr(), 0, 0, this.stack.getDpr(), 0, 0);

    const visibleRange = this.timeScale.getVisibleRange();
    for (const entry of model.overlays) {
      const pane = model.panes.find((candidate) => candidate.paneId === entry.paneId);
      if (!pane) {
        continue;
      }
      context.save();
      context.beginPath();
      context.rect(pane.plot.left, pane.plot.top, pane.plot.width, pane.plot.height);
      context.clip();
      const frame: OverlayRenderFrame = {
        paneId: pane.paneId,
        plot: pane.plot,
        visibleRange,
        timeToX: (time) => this.timeScale.timeToX(time),
        priceToY: (price) => pane.priceScale.priceToY(price, pane.plot.top, pane.plot.height),
        yToPrice: (y) => pane.priceScale.yToPrice(y, pane.plot.top, pane.plot.height),
      };
      entry.overlay.draw(context, frame);
      context.restore();
    }
  }

  private drawDrawings(model: ChartRenderModel): void {
    const context = this.stack.context("drawings");
    this.stack.clear("drawings");
    context.setTransform(this.stack.getDpr(), 0, 0, this.stack.getDpr(), 0, 0);

    for (const drawing of model.drawings) {
      const pane = model.panes.find((candidate) => candidate.paneId === drawing.paneId);
      if (!pane || !drawing.options.visible) {
        continue;
      }

      const points = anchorPoints(drawing.anchors, pane, this.timeScale).filter(
        (point): point is Point => point !== null,
      );
      if (points.length === 0) {
        continue;
      }
      if (drawing.previewPoint && points.length < drawing.anchorCount) {
        points.push(drawing.previewPoint);
      }
      const renderDrawing: DrawingRenderData = {
        ...drawing,
        options: resolveDrawingOptionsForModel(drawing.options, model),
      };

      context.save();
      context.beginPath();
      context.rect(pane.plot.left, pane.plot.top, pane.plot.width, pane.plot.height);
      context.clip();
      context.globalAlpha = drawing.preview ? 0.65 : 1;
      context.strokeStyle = renderDrawing.options.color;
      context.fillStyle = renderDrawing.options.fillColor;
      context.lineWidth = drawing.options.lineWidth;
      context.setLineDash(drawing.preview ? [4, 4] : dash(drawing.options.lineStyle));

      this.drawTool(context, model, pane, renderDrawing, points);
      this.drawDrawingStats(context, model, pane, renderDrawing, points);

      context.setLineDash([]);
      context.globalAlpha = 1;
      context.restore();

      if (drawing.selected && !drawing.preview) {
        context.save();
        context.beginPath();
        context.rect(pane.plot.left, pane.plot.top, pane.plot.width, pane.plot.height);
        context.clip();
        for (const point of points) {
          context.fillStyle = model.layout.background;
          context.fillRect(point.x - 4, point.y - 4, 8, 8);
          context.strokeStyle = renderDrawing.options.color;
          context.lineWidth = 1;
          context.strokeRect(point.x - 4, point.y - 4, 8, 8);
        }
        context.restore();
      }
    }

    this.drawDrawingPriceLabels(context, model);
    this.drawDrawingTimeLabels(context, model);

    if (model.selectionBox) {
      const left = Math.min(model.selectionBox.start.x, model.selectionBox.current.x);
      const top = Math.min(model.selectionBox.start.y, model.selectionBox.current.y);
      const width = Math.abs(model.selectionBox.current.x - model.selectionBox.start.x);
      const height = Math.abs(model.selectionBox.current.y - model.selectionBox.start.y);
      context.save();
      context.fillStyle = "rgba(41,98,255,0.08)";
      context.strokeStyle = "#2962ff";
      context.lineWidth = 1;
      context.setLineDash([4, 3]);
      context.fillRect(left, top, width, height);
      context.strokeRect(crisp(left), crisp(top), width, height);
      context.setLineDash([]);
      context.restore();
    }
  }

  private drawTool(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    pane: PaneRenderModel,
    drawing: DrawingRenderData,
    points: Point[],
  ): void {
    const { plot } = pane;

    switch (drawing.toolId) {
      case "horizontal-line": {
        if (!drawing.options.showLine) {
          return;
        }
        const y = crisp(points[0]!.y);
        context.beginPath();
        context.moveTo(plot.left, y);
        context.lineTo(plot.right, y);
        context.stroke();
        return;
      }
      case "horizontal-ray": {
        if (!drawing.options.showLine) {
          return;
        }
        const y = crisp(points[0]!.y);
        context.beginPath();
        context.moveTo(points[0]!.x, y);
        context.lineTo(plot.right, y);
        context.stroke();
        return;
      }
      case "vertical-line": {
        if (!drawing.options.showLine) {
          return;
        }
        const x = crisp(points[0]!.x);
        context.beginPath();
        context.moveTo(x, plot.top);
        context.lineTo(x, plot.bottom);
        context.stroke();
        return;
      }
      case "cross-line": {
        if (!drawing.options.showLine) {
          return;
        }
        const x = crisp(points[0]!.x);
        const y = crisp(points[0]!.y);
        context.beginPath();
        context.moveTo(plot.left, y);
        context.lineTo(plot.right, y);
        context.moveTo(x, plot.top);
        context.lineTo(x, plot.bottom);
        context.stroke();
        return;
      }
      case "trend-line": {
        if (points.length < 2) {
          return;
        }
        const first = points[0]!;
        const second = points[1]!;
        const clipped = clipTrendLine(first, second, plot, drawing.options);
        if (!clipped) {
          return;
        }
        if (drawing.options.showLine) {
          context.beginPath();
          context.moveTo(clipped[0].x, clipped[0].y);
          context.lineTo(clipped[1].x, clipped[1].y);
          context.stroke();
        }
        const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
        if (drawing.options.showMidpoint) {
          context.save();
          context.fillStyle = drawing.options.color;
          context.beginPath();
          context.arc(midpoint.x, midpoint.y, 3, 0, Math.PI * 2);
          context.fill();
          context.restore();
        }
        if (drawing.options.text) {
          drawDrawingText(context, model, drawing.options.text, first, second, drawing.options);
        }
        return;
      }
      case "ray": {
        if (points.length < 2) {
          return;
        }
        if (!drawing.options.showLine) {
          return;
        }
        const clipped = clipRayToPlot(points[0]!, points[1]!, plot);
        if (!clipped) {
          return;
        }
        context.beginPath();
        context.moveTo(clipped[0].x, clipped[0].y);
        context.lineTo(clipped[1].x, clipped[1].y);
        context.stroke();
        return;
      }
      case "extended-line": {
        if (points.length < 2) {
          return;
        }
        if (!drawing.options.showLine) {
          return;
        }
        const clipped = clipExtendedLineToPlot(points[0]!, points[1]!, plot);
        if (!clipped) {
          return;
        }
        context.beginPath();
        context.moveTo(clipped[0].x, clipped[0].y);
        context.lineTo(clipped[1].x, clipped[1].y);
        context.stroke();
        return;
      }
      case "arrow": {
        if (points.length < 2) {
          return;
        }
        if (!drawing.options.showLine) {
          return;
        }
        const first = points[0]!;
        const second = points[1]!;
        const clipped = clipLineToRect(first, second, plot);
        if (!clipped) {
          return;
        }
        context.beginPath();
        context.moveTo(clipped[0].x, clipped[0].y);
        context.lineTo(clipped[1].x, clipped[1].y);
        context.stroke();
        if (
          second.x >= plot.left &&
          second.x <= plot.right &&
          second.y >= plot.top &&
          second.y <= plot.bottom
        ) {
          const angle = Math.atan2(second.y - first.y, second.x - first.x);
          drawArrowHead(context, second, angle);
        }
        return;
      }
      case "trend-angle": {
        if (points.length < 2) {
          return;
        }
        const first = points[0]!;
        const second = points[1]!;
        const clipped = clipLineToRect(first, second, plot);
        if (!clipped) {
          return;
        }
        if (drawing.options.showLine) {
          context.beginPath();
          context.moveTo(clipped[0].x, clipped[0].y);
          context.lineTo(clipped[1].x, clipped[1].y);
          context.stroke();
        }
        if (drawing.options.showLabels) {
          const angle = (Math.atan2(-(second.y - first.y), second.x - first.x) * 180) / Math.PI;
          this.drawLabel(
            context,
            model,
            `${angle.toFixed(1)}°`,
            (first.x + second.x) / 2 + 8,
            (first.y + second.y) / 2 - 8,
            drawing.options,
          );
        }
        return;
      }
      case "rectangle":
      case "price-date-range": {
        if (points.length < 2) {
          return;
        }
        const x = Math.min(points[0]!.x, points[1]!.x);
        const y = Math.min(points[0]!.y, points[1]!.y);
        const width = Math.abs(points[1]!.x - points[0]!.x);
        const height = Math.abs(points[1]!.y - points[0]!.y);

        context.globalAlpha = drawing.preview ? 0.3 : drawing.options.fillOpacity;
        context.fillRect(x, y, width, height);
        context.globalAlpha = drawing.preview ? 0.65 : 1;
        context.strokeRect(x, y, width, height);

        if (
          drawing.toolId === "price-date-range" &&
          drawing.options.showLabels &&
          drawing.anchors[1]
        ) {
          const firstPrice = pane.priceScale.yToPrice(points[0]!.y, plot.top, plot.height);
          const priceDelta =
            pane.priceScale.yToPrice(points[1]!.y, plot.top, plot.height) - firstPrice;
          const percent = firstPrice === 0 ? 0 : (priceDelta / Math.abs(firstPrice)) * 100;
          const seconds = Math.abs(drawing.anchors[1]!.time - drawing.anchors[0]!.time) / 1000;
          this.drawLabel(
            context,
            model,
            `${priceDelta >= 0 ? "+" : ""}${pane.priceScale.formatValue(priceDelta, model.locale)} (${percent.toFixed(2)}%)  ${formatDuration(seconds)}`,
            x + 8,
            y + model.layout.fontSize + 4,
            drawing.options,
          );
        }
        return;
      }
      case "circle": {
        if (points.length < 2) {
          return;
        }
        const cx = (points[0]!.x + points[1]!.x) / 2;
        const cy = (points[0]!.y + points[1]!.y) / 2;
        const rx = Math.abs(points[1]!.x - points[0]!.x) / 2;
        const ry = Math.abs(points[1]!.y - points[0]!.y) / 2;
        context.beginPath();
        context.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
        context.globalAlpha = drawing.preview ? 0.3 : drawing.options.fillOpacity;
        context.fill();
        context.globalAlpha = drawing.preview ? 0.65 : 1;
        context.stroke();
        return;
      }
      case "parallel-channel": {
        if (points.length < 2) {
          return;
        }
        if (points.length < 3) {
          context.beginPath();
          context.moveTo(points[0]!.x, points[0]!.y);
          context.lineTo(points[1]!.x, points[1]!.y);
          context.stroke();
          return;
        }
        const channel = parallelLines(points);
        context.beginPath();
        context.moveTo(channel[0][0].x, channel[0][0].y);
        context.lineTo(channel[0][1].x, channel[0][1].y);
        context.lineTo(channel[1][1].x, channel[1][1].y);
        context.lineTo(channel[1][0].x, channel[1][0].y);
        context.closePath();
        context.globalAlpha = drawing.preview ? 0.15 : drawing.options.fillOpacity;
        context.fill();
        context.globalAlpha = drawing.preview ? 0.65 : 1;
        context.stroke();
        for (const line of channel) {
          context.beginPath();
          context.moveTo(line[0].x, line[0].y);
          context.lineTo(line[1].x, line[1].y);
          context.stroke();
        }
        return;
      }
      case "regression-trend": {
        if (points.length < 2) {
          return;
        }
        const regression = regressionChannel(pane, drawing, this.timeScale);
        if (!regression) {
          return;
        }
        drawChannelPolygon(context, drawing, regression.channel);
        context.beginPath();
        context.moveTo(regression.line[0].x, regression.line[0].y);
        context.lineTo(regression.line[1].x, regression.line[1].y);
        context.stroke();
        return;
      }
      case "flat-top-bottom": {
        if (points.length < 3) {
          return;
        }
        drawChannelPolygon(context, drawing, flatChannelLines(points));
        return;
      }
      case "disjoint-channel": {
        if (points.length < 4) {
          return;
        }
        const geometry = disjointChannelGeometry(points);
        if (geometry.right > geometry.left) {
          const polygon = [
            pointOnLine(geometry.first, geometry.left),
            pointOnLine(geometry.first, geometry.right),
            pointOnLine(geometry.second, geometry.right),
            pointOnLine(geometry.second, geometry.left),
          ];
          context.beginPath();
          context.moveTo(polygon[0]!.x, polygon[0]!.y);
          for (let index = 1; index < polygon.length; index += 1) {
            context.lineTo(polygon[index]!.x, polygon[index]!.y);
          }
          context.closePath();
          context.globalAlpha = drawing.preview ? 0.15 : drawing.options.fillOpacity;
          context.fill();
          context.globalAlpha = drawing.preview ? 0.65 : 1;
        }
        context.beginPath();
        context.moveTo(geometry.first[0].x, geometry.first[0].y);
        context.lineTo(geometry.first[1].x, geometry.first[1].y);
        context.moveTo(geometry.second[0].x, geometry.second[0].y);
        context.lineTo(geometry.second[1].x, geometry.second[1].y);
        context.stroke();
        return;
      }
      case "fib-channel": {
        if (points.length < 3) {
          return;
        }
        const channel = parallelLines(points);
        drawChannelPolygon(context, drawing, channel);
        for (const level of FIB_LEVELS) {
          const start = {
            x: channel[0][0].x,
            y: channel[0][0].y + (channel[1][0].y - channel[0][0].y) * level,
          };
          const end = {
            x: channel[0][1].x,
            y: channel[0][1].y + (channel[1][1].y - channel[0][1].y) * level,
          };
          context.beginPath();
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
          context.stroke();

          if (drawing.options.showLabels) {
            this.drawLabel(context, model, level.toFixed(3), start.x + 8, start.y, drawing.options);
          }
        }
        return;
      }
      case "fib-time-zone": {
        if (points.length < 2) {
          return;
        }
        for (const entry of fibTimeZoneValues(points)) {
          if (entry.x < plot.left || entry.x > plot.right) {
            continue;
          }
          const x = crisp(entry.x);
          context.beginPath();
          context.moveTo(x, plot.top);
          context.lineTo(x, plot.bottom);
          context.stroke();
          if (drawing.options.showLabels) {
            this.drawLabel(
              context,
              model,
              String(entry.ratio),
              x + 5,
              plot.top + model.layout.fontSize,
              drawing.options,
            );
          }
        }
        return;
      }
      case "pitchfork":
      case "schiff-pitchfork":
      case "modified-schiff-pitchfork": {
        if (points.length < 3) {
          return;
        }
        const variant =
          drawing.toolId === "pitchfork"
            ? "andrews"
            : drawing.toolId === "schiff-pitchfork"
              ? "schiff"
              : "modified-schiff";
        for (const line of pitchforkLines(points, variant)) {
          const clipped = clipExtendedLineToPlot(line[0], line[1], plot);
          if (!clipped) {
            continue;
          }
          context.beginPath();
          context.moveTo(clipped[0].x, clipped[0].y);
          context.lineTo(clipped[1].x, clipped[1].y);
          context.stroke();
        }
        return;
      }
      case "gann-fan": {
        if (points.length < 2) {
          return;
        }
        for (const entry of gannFanLines(points)) {
          const clipped = clipRayToPlot(entry.line[0], entry.line[1], plot);
          if (!clipped) {
            continue;
          }
          context.beginPath();
          context.moveTo(clipped[0].x, clipped[0].y);
          context.lineTo(clipped[1].x, clipped[1].y);
          context.stroke();
          if (drawing.options.showLabels) {
            this.drawLabel(
              context,
              model,
              entry.label,
              Math.min(plot.right - 8, clipped[1].x + 8),
              clipped[1].y,
              drawing.options,
            );
          }
        }
        return;
      }
      case "speed-lines": {
        if (points.length < 3) {
          return;
        }
        for (const line of speedLineLines(points)) {
          const clipped = clipRayToPlot(line[0], line[1], plot);
          if (!clipped) {
            continue;
          }
          context.beginPath();
          context.moveTo(clipped[0].x, clipped[0].y);
          context.lineTo(clipped[1].x, clipped[1].y);
          context.stroke();
        }
        return;
      }
      case "long-short-position": {
        if (points.length < 3) {
          return;
        }
        const entry = points[0]!;
        const stop = points[1]!;
        const target = points[2]!;
        const left = Math.min(entry.x, stop.x, target.x);
        const right = Math.max(entry.x, stop.x, target.x);
        const width = Math.max(1, right - left);
        const stopTop = Math.min(entry.y, stop.y);
        const stopHeight = Math.max(1, Math.abs(stop.y - entry.y));
        const targetTop = Math.min(entry.y, target.y);
        const targetHeight = Math.max(1, Math.abs(target.y - entry.y));

        context.globalAlpha = drawing.options.fillOpacity;
        context.fillStyle = "#ef5350";
        context.fillRect(left, stopTop, width, stopHeight);
        context.fillStyle = "#26a69a";
        context.fillRect(left, targetTop, width, targetHeight);
        context.globalAlpha = drawing.preview ? 0.65 : 1;
        context.strokeRect(left, stopTop, width, stopHeight);
        context.strokeRect(left, targetTop, width, targetHeight);
        context.beginPath();
        context.moveTo(left, entry.y);
        context.lineTo(right, entry.y);
        context.stroke();

        if (drawing.options.showLabels) {
          const risk = Math.abs(
            pane.priceScale.yToPrice(stop.y, plot.top, plot.height) -
              pane.priceScale.yToPrice(entry.y, plot.top, plot.height),
          );
          const reward = Math.abs(
            pane.priceScale.yToPrice(target.y, plot.top, plot.height) -
              pane.priceScale.yToPrice(entry.y, plot.top, plot.height),
          );
          const ratio = risk === 0 ? "∞" : (reward / risk).toFixed(2);
          this.drawLabel(
            context,
            model,
            `Entry ${pane.priceScale.formatValue(pane.priceScale.yToPrice(entry.y, plot.top, plot.height), model.locale)}  R/R ${ratio}`,
            left + 8,
            entry.y - 10,
            drawing.options,
          );
        }
        return;
      }
      case "fib-retracement": {
        if (points.length < 2) {
          return;
        }
        const first = points[0]!;
        const second = points[1]!;
        for (const level of FIB_LEVELS) {
          const y = first.y + (second.y - first.y) * level;
          context.beginPath();
          context.moveTo(plot.left, y);
          context.lineTo(plot.right, y);
          context.stroke();

          if (drawing.options.showLabels) {
            const value = pane.priceScale.yToPrice(y, plot.top, plot.height);
            this.drawLabel(
              context,
              model,
              `${level.toFixed(3)}  ${pane.priceScale.formatValue(value, model.locale)}`,
              plot.left + 8,
              y,
              drawing.options,
            );
          }
        }
        return;
      }
      case "fib-extension": {
        if (points.length < 3) {
          return;
        }
        const delta = points[1]!.y - points[0]!.y;
        for (const level of FIB_EXTENSION_LEVELS) {
          const y = points[2]!.y + delta * level;
          context.beginPath();
          context.moveTo(plot.left, y);
          context.lineTo(plot.right, y);
          context.stroke();

          if (drawing.options.showLabels) {
            const value = pane.priceScale.yToPrice(y, plot.top, plot.height);
            this.drawLabel(
              context,
              model,
              `${level.toFixed(3)}  ${pane.priceScale.formatValue(value, model.locale)}`,
              plot.left + 8,
              y,
              drawing.options,
            );
          }
        }
        return;
      }
      case "elliott-impulse":
      case "elliott-correction":
      case "elliott-triangle":
      case "elliott-double-combo":
      case "elliott-triple-combo": {
        if (points.length < 2) {
          return;
        }
        if (drawing.options.showLine) {
          context.beginPath();
          context.moveTo(points[0]!.x, points[0]!.y);
          for (let index = 1; index < points.length; index += 1) {
            context.lineTo(points[index]!.x, points[index]!.y);
          }
          context.stroke();
        }

        if (drawing.options.showLabels) {
          const labels = drawing.options.labels ?? ELLIOTT_LABELS[drawing.toolId] ?? [];
          const fontSize = drawing.options.labelFontSize ?? model.layout.fontSize;
          const boxHeight = fontSize + 6;
          const minLabelY = plot.top + boxHeight / 2;
          const maxLabelY = plot.bottom - boxHeight / 2;
          for (let index = 0; index < points.length; index += 1) {
            const label = labels[index];
            const point = points[index];
            if (
              !label ||
              !point ||
              point.x < plot.left ||
              point.x > plot.right ||
              point.y < plot.top ||
              point.y > plot.bottom
            ) {
              continue;
            }
            let side = elliottLabelPlacement(points, index, drawing.options.labelPlacement);
            if (side === "above" && point.y - boxHeight - 4 < plot.top) {
              side = "below";
            } else if (side === "below" && point.y + boxHeight + 4 > plot.bottom) {
              side = "above";
            }
            const rawY =
              side === "above" ? point.y - boxHeight / 2 - 4 : point.y + boxHeight / 2 + 4;
            this.drawLabel(
              context,
              model,
              label,
              point.x,
              Math.max(minLabelY, Math.min(maxLabelY, rawY)),
              drawing.options,
              drawing.options.color,
              "center",
            );
          }
        }
        return;
      }
      case "brush":
      case "highlighter":
      case "path": {
        if (points.length < 2) {
          return;
        }
        context.save();
        context.lineCap = "round";
        context.lineJoin = "round";
        context.beginPath();
        context.moveTo(points[0]!.x, points[0]!.y);
        for (let index = 1; index < points.length; index += 1) {
          context.lineTo(points[index]!.x, points[index]!.y);
        }
        context.stroke();
        context.restore();
        return;
      }
      case "text": {
        const text = drawing.options.text;
        if (!text) {
          return;
        }
        context.fillStyle = drawing.options.color;
        context.font = `${drawing.options.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        context.textAlign = "left";
        context.textBaseline = "bottom";
        context.fillText(text, points[0]!.x, points[0]!.y);
        return;
      }
      case "measure":
      case "stats-line": {
        if (points.length < 2) {
          return;
        }
        const first = points[0]!;
        const second = points[1]!;
        const priceDelta =
          pane.priceScale.yToPrice(second.y, plot.top, plot.height) -
          pane.priceScale.yToPrice(first.y, plot.top, plot.height);
        const lineColor =
          drawing.toolId === "measure"
            ? priceDelta >= 0
              ? "#26a69a"
              : "#ef5350"
            : drawing.options.color;
        context.strokeStyle = lineColor;
        context.beginPath();
        context.moveTo(first.x, first.y);
        context.lineTo(second.x, second.y);
        context.stroke();

        if (drawing.options.showLabels && drawing.anchors[1]) {
          const firstPrice = pane.priceScale.yToPrice(first.y, plot.top, plot.height);
          const percent = firstPrice === 0 ? 0 : (priceDelta / Math.abs(firstPrice)) * 100;
          const seconds = Math.abs(drawing.anchors[1].time - drawing.anchors[0]!.time) / 1000;
          const deltaText = formatDuration(seconds);
          const label = `${priceDelta >= 0 ? "+" : ""}${pane.priceScale.formatValue(priceDelta, model.locale)} (${percent.toFixed(2)}%)  ${deltaText}`;
          this.drawLabel(
            context,
            model,
            label,
            (first.x + second.x) / 2 + 8,
            (first.y + second.y) / 2 - 8,
            drawing.options,
            drawing.toolId === "measure" ? lineColor : undefined,
          );
        }
        return;
      }
      default:
        return;
    }
  }

  private drawDrawingStats(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    pane: PaneRenderModel,
    drawing: DrawingRenderData,
    points: readonly Point[],
  ): void {
    const mode = drawing.options.stats;
    if (mode === "off" || (mode === "selected" && !drawing.selected)) {
      return;
    }
    const lines = drawingStatsLines(drawing, pane, model, points);
    if (lines.length === 0) {
      return;
    }
    const fontSize = drawing.options.labelFontSize ?? model.layout.fontSize;
    const padding = 8;
    const gap = 10;
    const lineHeight = fontSize + 4;
    context.font = this.font(model, fontSize);
    const width = Math.max(...lines.map((line) => context.measureText(line).width)) + padding * 2;
    const height = lines.length * lineHeight + padding * 2;
    if (width > pane.plot.width || height > pane.plot.height) {
      return;
    }

    const first = points[0]!;
    const last = points[points.length - 1]!;
    const midX = (first.x + last.x) / 2;
    const midY = (first.y + last.y) / 2;
    let referenceX = midX;
    let referenceY = midY;
    let x: number;
    const position = drawing.options.statsPosition;
    if (position === "left") {
      referenceX = first.x;
      referenceY = first.y;
      x = referenceX + gap;
    } else if (position === "right") {
      referenceX = last.x;
      referenceY = last.y;
      x = referenceX - width - gap;
    } else if (position === "center") {
      x = midX - width / 2;
    } else {
      const leftSpace = first.x - pane.plot.left;
      const rightSpace = pane.plot.right - last.x;
      if (rightSpace >= leftSpace) {
        referenceX = last.x;
        referenceY = last.y;
        x = referenceX - width - gap;
      } else {
        referenceX = first.x;
        referenceY = first.y;
        x = referenceX + gap;
      }
    }

    x = Math.max(pane.plot.left + padding, Math.min(pane.plot.right - width - padding, x));
    let y = referenceY - height - gap;
    if (y < pane.plot.top + padding) {
      y = referenceY + gap;
    }
    y = Math.max(pane.plot.top + padding, Math.min(pane.plot.bottom - height - padding, y));

    const surface = chartContrastSurface(model.layout);
    context.save();
    context.fillStyle = surface.background;
    context.fillRect(x, y, width, height);
    context.fillStyle = surface.text;
    context.textAlign = "left";
    context.textBaseline = "top";
    for (let index = 0; index < lines.length; index += 1) {
      context.fillText(lines[index]!, x + padding, y + padding + index * lineHeight);
    }
    context.restore();
  }

  private drawDrawingPriceLabels(context: CanvasRenderingContext2D, model: ChartRenderModel): void {
    const entries: Array<{
      pane: PaneRenderModel;
      y: number;
      label: string;
      color: string;
    }> = [];
    for (const drawing of model.drawings) {
      if (drawing.preview || drawing.toolId !== "trend-line") {
        continue;
      }
      const pane = model.panes.find((candidate) => candidate.paneId === drawing.paneId);
      const options = resolveDrawingOptionsForModel(drawing.options, model);
      if (!pane || options.priceLabels === "never") {
        continue;
      }
      if (options.priceLabels === "selected" && !drawing.selected) {
        continue;
      }
      for (const anchor of drawing.anchors.slice(0, 2)) {
        const y = pane.priceScale.priceToY(anchor.price, pane.plot.top, pane.plot.height);
        if (y < pane.plot.top || y > pane.plot.bottom) {
          continue;
        }
        entries.push({
          pane,
          y,
          label: pane.priceScale.formatValue(anchor.price, model.locale),
          color: options.color,
        });
      }
    }
    entries.sort((first, second) => first.y - second.y);

    const boxHeight = model.layout.fontSize + 6;
    const lastBottom = new Map<string, number>();
    for (const entry of entries) {
      let top = entry.y - boxHeight / 2;
      const previous = lastBottom.get(entry.pane.paneId);
      if (previous !== undefined && top < previous + 2) {
        top = previous + 2;
      }
      top = Math.max(entry.pane.plot.top, Math.min(entry.pane.plot.bottom - boxHeight, top));
      lastBottom.set(entry.pane.paneId, top + boxHeight);

      context.fillStyle = entry.color;
      context.fillRect(entry.pane.plot.right, top, model.axisWidth, boxHeight);
      context.fillStyle = "#ffffff";
      context.font = this.font(model);
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(entry.label, entry.pane.plot.right + 8, top + boxHeight / 2);
    }
  }

  private drawDrawingTimeLabels(context: CanvasRenderingContext2D, model: ChartRenderModel): void {
    const bottomPane = model.panes[model.panes.length - 1];
    if (!bottomPane) {
      return;
    }
    const fontSize = model.layout.fontSize;
    const boxHeight = fontSize + 4;
    const top = bottomPane.plot.bottom + Math.max(0, (model.axisHeight - boxHeight) / 2);
    context.font = this.font(model);
    context.textAlign = "center";
    context.textBaseline = "middle";

    const entries: Array<{ left: number; width: number; label: string; color: string }> = [];
    for (const drawing of model.drawings) {
      if (drawing.preview || drawing.toolId !== "trend-line") {
        continue;
      }
      const options = resolveDrawingOptionsForModel(drawing.options, model);
      if (options.timeLabels === "never") {
        continue;
      }
      if (options.timeLabels === "selected" && !drawing.selected) {
        continue;
      }
      for (const anchor of drawing.anchors.slice(0, 2)) {
        const x = this.timeScale.timeToX(anchor.time);
        if (x === null || x < bottomPane.plot.left || x > bottomPane.plot.right) {
          continue;
        }
        const label = formatCrosshairTime(
          anchor.time,
          model.locale,
          this.timeScale.getCalendarTimezone() ?? model.timezone,
          model.secondsVisible,
        );
        const width = context.measureText(label).width + 10;
        const left = Math.max(
          bottomPane.plot.left,
          Math.min(bottomPane.plot.right - width, x - width / 2),
        );
        entries.push({ left, width, label, color: options.color });
      }
    }
    entries.sort((first, second) => first.left - second.left);

    let lastRight = Number.NEGATIVE_INFINITY;
    for (const entry of entries) {
      if (entry.left < lastRight + 2) {
        continue;
      }
      context.fillStyle = entry.color;
      context.fillRect(entry.left, top, entry.width, boxHeight);
      context.fillStyle = "#ffffff";
      context.fillText(entry.label, entry.left + entry.width / 2, top + boxHeight / 2);
      lastRight = entry.left + entry.width;
    }
  }

  private drawLabel(
    context: CanvasRenderingContext2D,
    model: ChartRenderModel,
    text: string,
    x: number,
    y: number,
    options: ResolvedDrawingOptions,
    color?: string,
    align: "left" | "center" = "left",
  ): void {
    const fontSize = options.labelFontSize ?? model.layout.fontSize;
    context.font = this.font(model, fontSize);
    context.textAlign = "left";
    context.textBaseline = "middle";
    const textWidth = context.measureText(text).width;
    const width = textWidth + 10;
    const height = fontSize + 6;
    const left = align === "center" ? Math.max(0, x - width / 2) : Math.max(0, x - 5);
    const top = y - height / 2;

    if (options.labelBackgroundVisible) {
      context.fillStyle = color ?? model.crosshair.labelBackground ?? "#131722";
      context.fillRect(left, top, width, height);
      context.fillStyle = "#ffffff";
      context.fillText(text, left + 5, y);
      return;
    }

    context.fillStyle = color ?? options.color;
    context.fillText(text, align === "center" ? Math.max(0, x - textWidth / 2) : Math.max(0, x), y);
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
    const labelSurface = model.crosshair.labelBackground
      ? {
          background: model.crosshair.labelBackground,
          text: contrastTextOnColor(model.crosshair.labelBackground),
        }
      : chartContrastSurface(model.layout);
    const boxHeight = model.layout.axisFontSize + 6;
    const priceTop = Math.max(
      hovered.plot.top,
      Math.min(hovered.plot.bottom - boxHeight, y - boxHeight / 2),
    );

    context.fillStyle = labelSurface.background;
    context.fillRect(hovered.plot.right, priceTop, model.axisWidth, boxHeight);
    context.fillStyle = labelSurface.text;
    context.font = this.axisFont(model);
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(priceLabel, hovered.plot.right + 8, priceTop + boxHeight / 2);

    const time = this.timeScale.timeAtX(x);
    if (time !== null) {
      context.font = this.axisFont(model);
      const label = formatCrosshairTime(
        time,
        model.locale,
        this.timeScale.getCalendarTimezone() ?? model.timezone,
        model.secondsVisible,
      );
      const width = context.measureText(label).width + 16;
      const left = Math.max(
        bottomPane.plot.left,
        Math.min(bottomPane.plot.right - width, x - width / 2),
      );
      context.fillStyle = labelSurface.background;
      context.fillRect(left, bottomPane.plot.bottom, width, model.axisHeight);
      context.fillStyle = labelSurface.text;
      context.textAlign = "center";
      context.fillText(label, left + width / 2, bottomPane.plot.bottom + model.axisHeight / 2);
    }

    context.restore();
  }
}

function resolveDrawingOptionsForModel(
  options: ResolvedDrawingOptions,
  model: ChartRenderModel,
): ResolvedDrawingOptions {
  const resolve = (color: string | "theme"): string =>
    color === "theme" ? model.layout.textColor : color;
  return {
    ...options,
    color: resolve(options.color),
    fillColor: resolve(options.fillColor),
    textColor: resolve(options.textColor),
  };
}

function drawingStatsLines(
  drawing: DrawingRenderData,
  pane: PaneRenderModel,
  model: ChartRenderModel,
  points: readonly Point[],
): string[] {
  if (drawing.anchors.length === 0) {
    return [];
  }
  const prices = drawing.anchors.map((anchor) => anchor.price);
  const times = drawing.anchors.map((anchor) => anchor.time);
  const firstTime = times[0]!;
  const lastTime = times[times.length - 1]!;
  const first = prices[0]!;
  const last = prices[prices.length - 1]!;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const delta = last - first;
  const percent = first === 0 ? 0 : (delta / Math.abs(first)) * 100;
  const format = (value: number): string => pane.priceScale.formatValue(value, model.locale);
  const lines: string[] = [];
  let seriesChecked = false;
  let series: PaneRenderModel["series"][number] | undefined;

  for (const field of drawing.options.statsFields) {
    if (field === "range") {
      lines.push(`Range  ${format(minPrice)} – ${format(maxPrice)}`);
    } else if (field === "change") {
      lines.push(`Change  ${delta >= 0 ? "+" : ""}${format(delta)} (${percent.toFixed(2)}%)`);
    } else if (field === "bars") {
      if (!seriesChecked) {
        series =
          pane.series.find((candidate) => candidate.visible && candidate.store.length > 0) ??
          pane.series.find((candidate) => candidate.store.length > 0);
        seriesChecked = true;
      }
      if (series) {
        const start = series.store.nearestIndex(Math.min(...times));
        const end = series.store.nearestIndex(Math.max(...times));
        if (start >= 0 && end >= 0) {
          lines.push(`Bars  ${Math.abs(end - start) + 1}`);
        }
      }
    } else if (field === "date") {
      const from = formatDrawingDate(Math.min(...times), model);
      const to = formatDrawingDate(Math.max(...times), model);
      lines.push(`Date  ${from === to ? from : `${from} → ${to}`}`);
    } else if (field === "timeRange") {
      const from = formatDrawingTime(Math.min(...times), model);
      const to = formatDrawingTime(Math.max(...times), model);
      lines.push(`Time  ${from === to ? from : `${from} → ${to}`}`);
    } else if (
      field === "duration" &&
      drawing.anchors.length >= 2 &&
      Number.isFinite(firstTime) &&
      Number.isFinite(lastTime)
    ) {
      lines.push(
        `Duration  ${formatDrawingDuration(Math.abs(lastTime - firstTime) / 1000, model.locale)}`,
      );
    } else if (
      field === "angle" &&
      points.length >= 2 &&
      ["trend-line", "ray", "extended-line", "arrow", "trend-angle"].includes(drawing.toolId)
    ) {
      const angle =
        (Math.atan2(-(points[1]!.y - points[0]!.y), points[1]!.x - points[0]!.x) * 180) / Math.PI;
      lines.push(`Angle  ${angle.toFixed(1)}°`);
    }
  }
  return lines;
}

const durationUnitFormatters = new Map<string, Intl.NumberFormat>();

function formatDurationUnit(
  value: number,
  unit: Intl.NumberFormatOptions["unit"],
  locale: string,
): string {
  const key = `${locale}|${unit}`;
  let formatter = durationUnitFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "unit",
      unit,
      unitDisplay: "narrow",
    });
    durationUnitFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

function formatDrawingDuration(seconds: number, locale: string): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const remainder = total % 60;
  if (days > 0) {
    return formatDurationPair(days, hours, "day", "hour", locale);
  }
  if (hours > 0) {
    return formatDurationPair(hours, minutes, "hour", "minute", locale);
  }
  if (minutes > 0) {
    return formatDurationPair(minutes, remainder, "minute", "second", locale);
  }
  return formatDurationUnit(remainder, "second", locale);
}

function formatDurationPair(
  major: number,
  minor: number,
  majorUnit: Intl.NumberFormatOptions["unit"],
  minorUnit: Intl.NumberFormatOptions["unit"],
  locale: string,
): string {
  const primary = formatDurationUnit(major, majorUnit, locale);
  return minor > 0 ? `${primary} ${formatDurationUnit(minor, minorUnit, locale)}` : primary;
}

function formatDrawingTime(time: number, model: ChartRenderModel): string {
  return formatCrosshairTime(time, model.locale, model.timezone, model.secondsVisible);
}

function formatDrawingDate(time: number, model: ChartRenderModel): string {
  const formatter = new Intl.DateTimeFormat(model.locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: model.timezone,
  });
  return formatter.format(time);
}

function clipTrendLine(
  first: Point,
  second: Point,
  plot: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  options: { extendLeft: boolean; extendRight: boolean },
): [Point, Point] | null {
  if (options.extendLeft && options.extendRight) {
    return clipExtendedLineToPlot(first, second, plot);
  }
  if (options.extendRight) {
    return clipRayToPlot(first, second, plot);
  }
  if (options.extendLeft) {
    return clipRayToPlot(second, first, plot);
  }
  return clipLineToRect(first, second, plot);
}

function drawDrawingText(
  context: CanvasRenderingContext2D,
  model: ChartRenderModel,
  text: string,
  first: Point,
  second: Point,
  options: ResolvedDrawingOptions,
): void {
  const style = [
    options.textStyle.includes("bold") ? "bold" : "",
    options.textStyle.includes("italic") ? "italic" : "",
  ]
    .filter(Boolean)
    .join(" ");
  let point: Point;
  let align: CanvasTextAlign;
  if (options.textAlign === "left") {
    point = { x: first.x - 6, y: first.y };
    align = "right";
  } else if (options.textAlign === "right") {
    point = { x: second.x + 6, y: second.y };
    align = "left";
  } else {
    point = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    align = "center";
  }
  context.save();
  context.font = `${style ? `${style} ` : ""}${options.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  context.fillStyle = options.textColor;
  context.textAlign = align;
  context.textBaseline = options.textVerticalAlign;
  context.fillText(text, point.x, point.y);
  context.restore();
}

function chartContrastSurface(layout: ResolvedLayout): {
  background: string;
  text: string;
} {
  const background = parseRgbColor(layout.background);
  const text = parseRgbColor(layout.textColor);
  const backgroundLuminance = background ? relativeLuminance(background) : null;
  const textLuminance = text ? relativeLuminance(text) : null;
  const light =
    backgroundLuminance !== null
      ? backgroundLuminance > 0.55
      : textLuminance !== null && textLuminance < 0.5;
  return light
    ? { background: "rgba(248,250,252,0.94)", text: "#111827" }
    : { background: "rgba(17,24,39,0.94)", text: "#f9fafb" };
}

function contrastTextOnColor(color: string): string {
  const rgb = parseRgbColor(color);
  return rgb && relativeLuminance(rgb) > 0.55 ? "#111827" : "#f9fafb";
}

function parseRgbColor(color: string): [number, number, number, number] | null {
  const value = color.trim().toLowerCase();
  if (value === "transparent") {
    return null;
  }
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const red = Number.parseInt(hex[0]! + hex[0]!, 16);
      const green = Number.parseInt(hex[1]! + hex[1]!, 16);
      const blue = Number.parseInt(hex[2]! + hex[2]!, 16);
      const alpha = hex.length === 4 ? Number.parseInt(hex[3]! + hex[3]!, 16) / 255 : 1;
      return [red, green, blue, alpha];
    }
    if (hex.length === 6 || hex.length === 8) {
      const red = Number.parseInt(hex.slice(0, 2), 16);
      const green = Number.parseInt(hex.slice(2, 4), 16);
      const blue = Number.parseInt(hex.slice(4, 6), 16);
      const alpha = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
      if ([red, green, blue, alpha].some((channel) => Number.isNaN(channel))) {
        return null;
      }
      return [red, green, blue, alpha];
    }
    return null;
  }
  const match = /^rgba?\(([^)]+)\)$/.exec(value);
  if (!match) {
    return null;
  }
  const channels = match[1]!.split(",").map((channel) => Number.parseFloat(channel.trim()));
  if (channels.length < 3 || channels.some((channel) => Number.isNaN(channel))) {
    return null;
  }
  return [channels[0]!, channels[1]!, channels[2]!, channels[3] ?? 1];
}

function relativeLuminance([red, green, blue]: readonly number[]): number {
  const channel = (value: number): number => {
    const normalized = Math.max(0, Math.min(255, value)) / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red!) + 0.7152 * channel(green!) + 0.0722 * channel(blue!);
}

function drawChannelPolygon(
  context: CanvasRenderingContext2D,
  drawing: DrawingRenderData,
  channel: [[Point, Point], [Point, Point]],
): void {
  context.beginPath();
  context.moveTo(channel[0][0].x, channel[0][0].y);
  context.lineTo(channel[0][1].x, channel[0][1].y);
  context.lineTo(channel[1][1].x, channel[1][1].y);
  context.lineTo(channel[1][0].x, channel[1][0].y);
  context.closePath();
  context.globalAlpha = drawing.preview ? 0.15 : drawing.options.fillOpacity;
  context.fill();
  context.globalAlpha = drawing.preview ? 0.65 : 1;
  for (const line of channel) {
    context.beginPath();
    context.moveTo(line[0].x, line[0].y);
    context.lineTo(line[1].x, line[1].y);
    context.stroke();
  }
}

function regressionChannel(
  pane: PaneRenderModel,
  drawing: DrawingRenderData,
  timeScale: TimeScale,
): { line: [Point, Point]; channel: [[Point, Point], [Point, Point]] } | null {
  if (drawing.anchors.length < 2) {
    return null;
  }
  const series =
    pane.series.find((candidate) => candidate.visible && candidate.store.length > 0) ??
    pane.series.find((candidate) => candidate.store.length > 0);
  if (!series) {
    return null;
  }
  const store = series.store;
  const fromTime = Math.min(drawing.anchors[0]!.time, drawing.anchors[1]!.time);
  const toTime = Math.max(drawing.anchors[0]!.time, drawing.anchors[1]!.time);
  const startIndex = store.nearestIndex(fromTime);
  const endIndex = store.nearestIndex(toTime);
  const first = Math.min(startIndex, endIndex);
  const last = Math.max(startIndex, endIndex);
  if (first < 0 || last <= first) {
    return null;
  }

  const step = Math.max(1, Math.ceil((last - first + 1) / 2_000));
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (let index = first; index <= last; index += step) {
    const x = index - first;
    const y = store.valueAt(index);
    if (!Number.isFinite(y)) {
      continue;
    }
    count += 1;
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumXY += x * y;
  }
  if (count < 2) {
    return null;
  }
  const denominator = count * sumXX - sumX * sumX;
  if (denominator === 0) {
    return null;
  }
  const slope = (count * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / count;

  let residualSum = 0;
  for (let index = first; index <= last; index += step) {
    const y = store.valueAt(index);
    if (!Number.isFinite(y)) {
      continue;
    }
    const residual = y - (intercept + slope * (index - first));
    residualSum += residual * residual;
  }
  const deviation = Math.sqrt(residualSum / count);

  const firstX = timeScale.timeToX(store.timeAt(first));
  const lastX = timeScale.timeToX(store.timeAt(last));
  if (firstX === null || lastX === null) {
    return null;
  }
  const firstPrice = intercept;
  const lastPrice = intercept + slope * (last - first);
  const firstY = pane.priceScale.priceToY(firstPrice, pane.plot.top, pane.plot.height);
  const lastY = pane.priceScale.priceToY(lastPrice, pane.plot.top, pane.plot.height);
  const firstUpper = pane.priceScale.priceToY(
    firstPrice + deviation,
    pane.plot.top,
    pane.plot.height,
  );
  const lastUpper = pane.priceScale.priceToY(
    lastPrice + deviation,
    pane.plot.top,
    pane.plot.height,
  );
  const firstLower = pane.priceScale.priceToY(
    firstPrice - deviation,
    pane.plot.top,
    pane.plot.height,
  );
  const lastLower = pane.priceScale.priceToY(
    lastPrice - deviation,
    pane.plot.top,
    pane.plot.height,
  );

  return {
    line: [
      { x: firstX, y: firstY },
      { x: lastX, y: lastY },
    ],
    channel: [
      [
        { x: firstX, y: firstUpper },
        { x: lastX, y: lastUpper },
      ],
      [
        { x: firstX, y: firstLower },
        { x: lastX, y: lastLower },
      ],
    ],
  };
}

function clipRayToPlot(
  first: Point,
  second: Point,
  plot: { left: number; top: number; right: number; bottom: number; width: number; height: number },
): [Point, Point] | null {
  const far = extendPoint(first, second, (plot.width + plot.height) * 2);
  return far ? clipLineToRect(first, far, plot) : null;
}

function clipExtendedLineToPlot(
  first: Point,
  second: Point,
  plot: { left: number; top: number; right: number; bottom: number; width: number; height: number },
): [Point, Point] | null {
  const forward = extendPoint(first, second, (plot.width + plot.height) * 2);
  const backward = extendPoint(second, first, (plot.width + plot.height) * 2);
  return forward && backward ? clipLineToRect(backward, forward, plot) : null;
}

function extendPoint(first: Point, second: Point, distance: number): Point | null {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return null;
  }
  const scale = distance / length;
  return { x: second.x + dx * scale, y: second.y + dy * scale };
}

function drawArrowHead(
  context: CanvasRenderingContext2D,
  point: Point,
  angle: number,
  size = 9,
): void {
  for (const offset of [-0.45, 0.45]) {
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(
      point.x - Math.cos(angle + offset) * size,
      point.y - Math.sin(angle + offset) * size,
    );
    context.stroke();
  }
}

function formatDuration(seconds: number): string {
  if (seconds >= 86_400) {
    return `${(seconds / 86_400).toFixed(1)}d`;
  }
  if (seconds >= 3_600) {
    return `${(seconds / 3_600).toFixed(1)}h`;
  }
  if (seconds >= 60) {
    return `${(seconds / 60).toFixed(1)}m`;
  }
  return `${seconds.toFixed(0)}s`;
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
