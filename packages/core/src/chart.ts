import type { OhlcStore } from "./data/ohlc-store";
import { fail, type WickError } from "./errors";
import { EventBus } from "./events";
import { Indicator } from "./indicator";
import { Pane, type PaneHost } from "./pane";
import { CanvasStack } from "./render/canvas-stack";
import {
  ChartRenderer,
  TIME_AXIS_HEIGHT,
  type ChartRenderModel,
  type CrosshairRenderPoint,
  type PaneRenderModel,
  type ResolvedCrosshair,
  type ResolvedGrid,
  type ResolvedLayout,
} from "./render/chart-renderer";
import { TimeScale, type TimeScaleSource } from "./scale/time-scale";
import { CandlestickSeries, Series, type SeriesHost } from "./series";
import type {
  AddIndicatorOptions,
  CandlestickSeriesOptions,
  ChartApi,
  ChartEventMap,
  ChartOptions,
  CrosshairOptions,
  GridOptions,
  IndicatorApi,
  IndicatorDefinition,
  IndicatorInputs,
  LayoutOptions,
  PaneApi,
  PaneOptions,
  Point,
  PriceScaleApi,
  PriceScaleOptions,
  SeriesApi,
  SeriesData,
  SeriesOptions,
  SeriesType,
  TimeScaleApi,
  TimeScaleOptions,
  Unsubscribe,
  VisibleRange,
  WickExtension,
} from "./types";
import { cancelFrame, mergeDefined, scheduleFrame } from "./util";

const AXIS_WIDTH = 64;

interface ResolvedOptions {
  autoSize: boolean;
  width: number;
  height: number;
  locale: string;
  timezone: string;
  layout: ResolvedLayout;
  grid: ResolvedGrid;
  crosshair: ResolvedCrosshair;
  timeScale: TimeScaleOptions;
  priceScale: PriceScaleOptions;
  extensions: readonly WickExtension[];
}

/**
 * Creates a chart inside the given container.
 *
 * The container must have a measurable size. With `autoSize` enabled the chart tracks it
 * with a `ResizeObserver`.
 */
export function createChart(container: HTMLElement, options: ChartOptions = {}): ChartApi {
  if (typeof document === "undefined") {
    fail("INVALID_ARGUMENT", "createChart requires a DOM");
  }
  if (!container || typeof container.appendChild !== "function") {
    fail("INVALID_ARGUMENT", "container must be an HTMLElement");
  }
  return new Chart(container, options);
}

class Chart implements ChartApi, SeriesHost {
  private readonly container: HTMLElement;
  private readonly bus = new EventBus();
  private readonly panes: Pane[] = [];
  private readonly mainPane: Pane;
  private readonly paneHost: PaneHost;
  private readonly stack: CanvasStack;
  private readonly timeScaleModel: TimeScale;
  private readonly renderer: ChartRenderer;
  private readonly timeScaleController: TimeScaleApi;

  private rawOptions: ChartOptions;
  private options: ResolvedOptions;
  private observer: ResizeObserver | null = null;
  private frame: number | null = null;
  private disposed = false;
  private readyEmitted = false;
  private seriesCounter = 0;
  private paneCounter = 0;
  private indicatorCounter = 0;
  private crosshairPoint: CrosshairRenderPoint | null = null;
  private readonly activePointers = new Map<number, Point>();
  private pinchDistance: number | null = null;
  private dragging = false;
  private pointerId: number | null = null;
  private dragLastX = 0;
  private dragMoved = false;

  constructor(container: HTMLElement, rawOptions: ChartOptions) {
    this.container = container;
    this.rawOptions = rawOptions;
    this.options = resolveOptions(rawOptions);

    this.stack = new CanvasStack(container);
    this.stack.root.style.touchAction = "none";
    this.stack.root.tabIndex = 0;
    this.stack.root.setAttribute("aria-label", "Chart");

    const source: TimeScaleSource = {
      count: () => this.primaryStore()?.length ?? 0,
      timeAt: (index) => {
        const store = this.primaryStore();
        if (!store || index < 0 || index >= store.length) {
          return undefined;
        }
        return store.timeAt(index);
      },
      nearestIndex: (time) => this.primaryStore()?.nearestIndex(time) ?? -1,
    };

    this.timeScaleModel = new TimeScale(source, this.options.timeScale);

    this.paneHost = {
      assertAlive: () => this.assertAlive(),
      requestRender: () => this.requestRender(),
      relayout: () => this.relayout(),
      removePane: (pane) => this.removePane(pane),
    };

    this.mainPane = new Pane("main", { priceScale: this.options.priceScale }, false, this.paneHost);
    this.panes.push(this.mainPane);

    this.renderer = new ChartRenderer(this.stack, this.timeScaleModel);

    this.timeScaleController = {
      getVisibleRange: () => {
        this.assertAlive();
        return this.timeScaleModel.getVisibleRange();
      },
      setVisibleRange: (range) => {
        this.assertAlive();
        this.timeScaleModel.setVisibleRange(range);
        this.requestRender();
        this.emitVisibleRange();
        this.notifyViewChange();
      },
      fitContent: () => {
        this.assertAlive();
        this.timeScaleModel.fitContent();
        this.requestRender();
        this.emitVisibleRange();
        this.notifyViewChange();
      },
      scrollToTime: (time) => {
        this.assertAlive();
        this.timeScaleModel.scrollToTime(time);
        this.requestRender();
        this.emitVisibleRange();
        this.notifyViewChange();
      },
      setOptions: (options) => {
        this.assertAlive();
        this.timeScaleModel.setOptions(options);
        this.rawOptions.timeScale = mergeDefined(this.rawOptions.timeScale ?? {}, options);
        this.options.timeScale = this.rawOptions.timeScale;
        this.requestRender();
        this.emitVisibleRange();
        this.notifyViewChange();
      },
    };

    this.attachEvents();
    this.setupObserver();
    this.resize();
  }

  addSeries<TData extends SeriesData, TOptions extends SeriesOptions>(
    type: SeriesType<TData, TOptions>,
    options?: TOptions,
  ): SeriesApi<TData, TOptions> {
    this.assertAlive();

    if (type.id !== CandlestickSeries.id) {
      fail("UNKNOWN_SERIES_TYPE", `Unsupported series type: ${type.id}`);
    }

    const paneId = (options as SeriesOptions | undefined)?.paneId ?? "main";
    const pane = this.findPane(paneId);
    if (!pane) {
      fail("INVALID_ARGUMENT", `Unknown pane: ${paneId}`);
    }

    this.seriesCounter += 1;
    const series = new Series(
      this,
      `series-${this.seriesCounter}`,
      CandlestickSeries,
      options as CandlestickSeriesOptions | undefined,
      pane.id,
    );
    pane.series.push(series);
    this.timeScaleModel.onDataChanged();
    this.requestRender();
    this.emitVisibleRange();

    return series as unknown as SeriesApi<TData, TOptions>;
  }

  addPane(options: PaneOptions = {}): PaneApi {
    this.assertAlive();

    this.paneCounter += 1;
    const pane = new Pane(
      `pane-${this.paneCounter}`,
      options,
      false,
      this.paneHost,
      this.options.priceScale,
    );
    this.panes.push(pane);
    this.relayout();
    return pane;
  }

  addIndicator<TInputs extends IndicatorInputs>(
    definition: IndicatorDefinition<TInputs>,
    options?: AddIndicatorOptions<TInputs>,
  ): IndicatorApi<TInputs> {
    this.assertAlive();

    const primary = this.primarySeries();
    if (!primary) {
      fail("INVALID_ARGUMENT", "Add a series before adding an indicator");
    }

    const sourceSeriesId = options?.sourceSeriesId ?? primary.id;
    if (sourceSeriesId !== primary.id) {
      fail("NOT_IMPLEMENTED", "Indicators currently support the primary series only");
    }

    const source = this.findSeries(sourceSeriesId);
    if (!source) {
      fail("INVALID_ARGUMENT", `Unknown source series: ${sourceSeriesId}`);
    }

    const requestedPane = options?.pane ?? definition.defaultPane ?? "main";
    let pane: Pane | undefined;

    if (requestedPane === "main") {
      pane = this.findPane(source.paneId);
    } else if (requestedPane === "separate") {
      this.paneCounter += 1;
      pane = new Pane(`pane-${this.paneCounter}`, {}, true, this.paneHost, this.options.priceScale);
      this.panes.push(pane);
    } else {
      pane = this.findPane(requestedPane);
    }

    if (!pane) {
      fail("INVALID_ARGUMENT", `Unknown pane: ${String(requestedPane)}`);
    }

    this.indicatorCounter += 1;
    const indicatorId = `indicator-${this.indicatorCounter}`;

    const indicator = new Indicator<TInputs>(
      indicatorId,
      sourceSeriesId,
      pane.id,
      definition,
      options?.inputs,
      {
        assertAlive: () => this.assertAlive(),
        getSourceStore: (seriesId) => this.findSeries(seriesId)?.getStore() ?? null,
        requestRender: () => this.requestRender(),
        reportError: (error) => this.emitIndicatorError(indicatorId, error),
        removeIndicator: (target) => this.removeIndicator(target),
      },
    );

    pane.indicators.push(indicator);
    indicator.markDirty();
    this.relayout();
    return indicator as IndicatorApi<TInputs>;
  }

  timeScale(): TimeScaleApi {
    this.assertAlive();
    return this.timeScaleController;
  }

  setOptions(patch: Partial<ChartOptions>): void {
    this.assertAlive();

    if (patch.extensions !== undefined) {
      fail("INVALID_ARGUMENT", "extensions cannot be changed after chart creation");
    }

    const merged = mergeChartOptions(this.rawOptions, patch);
    const next = resolveOptions(merged);

    if (patch.priceScale !== undefined) {
      this.mainPane.priceScale.setOptions(next.priceScale);
    }
    if (patch.timeScale !== undefined) {
      this.timeScaleModel.setOptions(next.timeScale);
    }

    this.rawOptions = merged;
    this.options = next;

    this.setupObserver();
    this.resize();
  }

  on<K extends keyof ChartEventMap>(
    event: K,
    handler: (payload: ChartEventMap[K]) => void,
  ): Unsubscribe {
    this.assertAlive();
    return this.bus.on(event, handler);
  }

  resize(): void {
    if (this.disposed) {
      return;
    }

    const width = this.options.autoSize ? this.container.clientWidth : this.options.width;
    const height = this.options.autoSize ? this.container.clientHeight : this.options.height;

    if (width <= 0 || height <= 0) {
      return;
    }

    if (this.options.autoSize) {
      this.stack.root.style.width = "100%";
      this.stack.root.style.height = "100%";
    } else {
      this.stack.root.style.width = `${width}px`;
      this.stack.root.style.height = `${height}px`;
    }

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    this.stack.resize(width, height, dpr);
    this.relayout();
  }

  private relayout(): void {
    if (this.disposed) {
      return;
    }

    const width = this.stack.getWidth();
    const height = this.stack.getHeight();
    if (width <= 0 || height <= 0) {
      return;
    }

    const plotWidth = Math.max(1, width - AXIS_WIDTH);
    const availableHeight = Math.max(1, height - TIME_AXIS_HEIGHT);
    const heights = computePaneHeights(this.panes, availableHeight);

    let top = 0;
    for (let index = 0; index < this.panes.length; index += 1) {
      const pane = this.panes[index]!;
      const paneHeight = heights[index]!;
      const bottom = index === this.panes.length - 1 ? availableHeight : top + paneHeight;
      pane.plot = {
        left: 0,
        top,
        right: plotWidth,
        bottom,
        width: plotWidth,
        height: bottom - top,
      };
      top = bottom;
    }

    this.timeScaleModel.setWidth(plotWidth);
    this.requestRender();
  }

  destroy(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    if (this.frame !== null) {
      cancelFrame(this.frame);
      this.frame = null;
    }

    this.teardownObserver();
    this.detachEvents();

    for (const pane of this.panes) {
      for (const series of pane.series) {
        series.destroyInternal();
      }
      for (const indicator of pane.indicators) {
        indicator.destroyInternal();
      }
      pane.indicators.length = 0;
      pane.series.length = 0;
    }

    this.activePointers.clear();
    this.pinchDistance = null;
    this.bus.dispose();
    this.panes.length = 0;
    this.stack.destroy();
  }

  // SeriesHost

  assertAlive(): void {
    if (this.disposed) {
      fail("DISPOSED", "Chart is disposed");
    }
  }

  requestRender(): void {
    if (this.disposed || this.frame !== null) {
      return;
    }

    this.frame = scheduleFrame(() => {
      this.frame = null;
      this.render();
    });
  }

  getVisibleRange(): VisibleRange {
    this.assertAlive();
    return this.timeScaleModel.getVisibleRange();
  }

  restoreVisibleRange(range: VisibleRange): void {
    try {
      this.timeScaleModel.setVisibleRange(range);
    } catch {
      // The stored data may no longer cover the previous range; keep the current one.
    }
    this.requestRender();
  }

  isAtRightEdge(): boolean {
    return this.timeScaleModel.isAtRightEdge();
  }

  fitContentIfDefault(): void {
    if (this.timeScaleModel.hasExplicitRange()) {
      return;
    }
    this.timeScaleModel.fitContent();
    this.requestRender();
    this.emitVisibleRange();
  }

  emitDataLoading(seriesId: string, loading: boolean): void {
    this.bus.emit("data-loading", { seriesId, loading });
  }

  emitDatafeedError(seriesId: string, error: WickError): void {
    this.bus.emit("error", { error, source: "datafeed", seriesId });
  }

  onSeriesDataChanged(series: Series): void {
    this.assertAlive();
    for (const pane of this.panes) {
      for (const indicator of pane.indicators) {
        if (indicator.sourceSeriesId === series.id) {
          indicator.markDirty();
        }
      }
    }
    this.timeScaleModel.onDataChanged();
    this.requestRender();
    this.emitVisibleRange();
  }

  private notifyViewChange(): void {
    if (this.disposed) {
      return;
    }
    for (const series of this.allSeries()) {
      series.onViewChanged();
    }
  }

  priceScaleApi(paneId: string): PriceScaleApi {
    this.assertAlive();
    const pane = this.findPane(paneId);
    if (!pane) {
      fail("INVALID_ARGUMENT", `Unknown pane: ${paneId}`);
    }
    return pane.priceScaleApi;
  }

  removeSeries(series: Series): void {
    const pane = this.panes.find((candidate) => candidate.series.includes(series));
    if (!pane) {
      return;
    }

    series.destroyInternal();
    pane.series.splice(pane.series.indexOf(series), 1);
    this.removeIndicatorsForSource(series.id);
    this.cleanupEmptyAutoPanes();
    this.timeScaleModel.onDataChanged();
    this.relayout();
    this.emitVisibleRange();
  }

  removeIndicator(indicator: Indicator): void {
    const pane = this.panes.find((candidate) => candidate.indicators.includes(indicator));
    if (!pane) {
      return;
    }
    indicator.destroyInternal();
    pane.indicators.splice(pane.indicators.indexOf(indicator), 1);
    this.cleanupEmptyAutoPanes();
    this.relayout();
  }

  private removeIndicatorsForSource(seriesId: string): void {
    for (const pane of [...this.panes]) {
      for (const indicator of [...pane.indicators]) {
        if (indicator.sourceSeriesId === seriesId) {
          indicator.destroyInternal();
          pane.indicators.splice(pane.indicators.indexOf(indicator), 1);
        }
      }
    }
    this.cleanupEmptyAutoPanes();
  }

  private cleanupEmptyAutoPanes(): void {
    for (let index = this.panes.length - 1; index >= 0; index -= 1) {
      const pane = this.panes[index]!;
      if (pane === this.mainPane) {
        continue;
      }
      if (pane.autoCreated && pane.series.length === 0 && pane.indicators.length === 0) {
        this.panes.splice(index, 1);
      }
    }
  }

  private removePane(pane: Pane): void {
    this.assertAlive();
    if (pane === this.mainPane) {
      fail("INVALID_ARGUMENT", "The main pane cannot be removed");
    }
    if (!this.panes.includes(pane)) {
      return;
    }

    for (const series of [...pane.series]) {
      series.destroyInternal();
      this.removeIndicatorsForSource(series.id);
    }

    for (const indicator of pane.indicators) {
      indicator.destroyInternal();
    }
    pane.series.length = 0;
    pane.indicators.length = 0;

    const index = this.panes.indexOf(pane);
    if (index >= 0) {
      this.panes.splice(index, 1);
    }

    this.cleanupEmptyAutoPanes();
    this.timeScaleModel.onDataChanged();
    this.relayout();
    this.emitVisibleRange();
  }

  private findPane(id: string): Pane | undefined {
    return this.panes.find((pane) => pane.id === id);
  }

  private allSeries(): Series[] {
    return this.panes.flatMap((pane) => pane.series);
  }

  private findSeries(id: string): Series | undefined {
    for (const pane of this.panes) {
      const series = pane.series.find((candidate) => candidate.id === id);
      if (series) {
        return series;
      }
    }
    return undefined;
  }

  private primarySeries(): Series | null {
    for (const pane of this.panes) {
      if (pane.series.length > 0) {
        return pane.series[0]!;
      }
    }
    return null;
  }

  private emitIndicatorError(indicatorId: string, error: WickError): void {
    this.bus.emit("error", { error, source: "indicator", indicatorId });
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }

    const point = this.localPoint(event);
    if (!this.paneAtPoint(point)) {
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    this.activePointers.set(event.pointerId, point);

    try {
      this.stack.root.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort.
    }

    if (this.activePointers.size === 2) {
      this.dragging = false;
      this.pointerId = null;
      this.pinchDistance = this.currentPinchDistance();
      this.clearCrosshair();
      return;
    }

    this.dragging = true;
    this.pointerId = event.pointerId;
    this.dragLastX = point.x;
    this.dragMoved = false;
    this.updateCrosshair(point.x, point.y);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const point = this.localPoint(event);

    if (this.activePointers.has(event.pointerId)) {
      this.activePointers.set(event.pointerId, point);
    }

    if (this.pinchDistance !== null && this.activePointers.size >= 2) {
      const distance = this.currentPinchDistance();
      if (distance !== null && distance > 0 && this.pinchDistance > 0) {
        const scale = distance / this.pinchDistance;
        if (Number.isFinite(scale) && scale !== 1) {
          const centerX = this.currentPinchCenterX();
          if (centerX !== null) {
            this.timeScaleModel.zoomAt(centerX, -Math.log(scale) / 0.0015);
            this.requestRender();
            this.emitVisibleRange();
            this.notifyViewChange();
          }
        }
      }
      this.pinchDistance = distance;
      this.clearCrosshair();
      return;
    }

    if (this.dragging && event.pointerId === this.pointerId) {
      const delta = point.x - this.dragLastX;
      if (Math.abs(delta) >= 0.5) {
        this.dragMoved = true;
        this.dragLastX = point.x;
        this.timeScaleModel.pan(delta);
        this.requestRender();
        this.emitVisibleRange();
        this.notifyViewChange();
      }
      this.updateCrosshair(point.x, point.y);
      return;
    }

    this.updateCrosshair(point.x, point.y);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);

    if (this.pinchDistance !== null) {
      try {
        this.stack.root.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort.
      }

      if (this.activePointers.size < 2) {
        this.pinchDistance = null;
        this.dragging = false;
        this.pointerId = null;
        this.clearCrosshair();
      }
      return;
    }

    if (!this.dragging || event.pointerId !== this.pointerId) {
      return;
    }

    const point = this.localPoint(event);
    this.dragging = false;
    this.pointerId = null;

    try {
      this.stack.root.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort.
    }

    if (!this.dragMoved && this.paneAtPoint(point)) {
      this.emitClick(point);
    }

    this.updateCrosshair(point.x, point.y);
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size < 2) {
      this.pinchDistance = null;
    }
    this.dragging = false;
    this.pointerId = null;
    this.clearCrosshair();
  };

  private readonly onPointerLeave = (): void => {
    if (!this.dragging && this.pinchDistance === null) {
      this.clearCrosshair();
    }
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const plot = this.panes[0]?.plot;
    if (!plot) {
      return;
    }

    const step = plot.width * 0.1;
    const center = plot.width / 2;

    switch (event.key) {
      case "ArrowLeft":
        this.timeScaleModel.pan(step);
        break;
      case "ArrowRight":
        this.timeScaleModel.pan(-step);
        break;
      case "+":
      case "=":
        this.timeScaleModel.zoomAt(center, -200);
        break;
      case "-":
      case "_":
        this.timeScaleModel.zoomAt(center, 200);
        break;
      case "Home":
        this.timeScaleModel.fitContent();
        break;
      case "Escape":
        this.clearCrosshair();
        event.preventDefault();
        return;
      default:
        return;
    }

    event.preventDefault();
    this.requestRender();
    this.emitVisibleRange();
    this.notifyViewChange();
  };

  private currentPinchDistance(): number | null {
    const points = Array.from(this.activePointers.values());
    if (points.length < 2) {
      return null;
    }

    const first = points[0]!;
    const second = points[1]!;
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  private currentPinchCenterX(): number | null {
    const points = Array.from(this.activePointers.values());
    const plot = this.panes[0]?.plot;
    if (points.length < 2 || !plot) {
      return null;
    }

    const first = points[0]!;
    const second = points[1]!;
    return Math.max(0, Math.min(plot.width, (first.x + second.x) / 2));
  }

  private readonly onWheel = (event: WheelEvent): void => {
    const point = this.localPoint(event);
    if (!this.paneAtPoint(point)) {
      return;
    }

    event.preventDefault();
    this.timeScaleModel.zoomAt(point.x, event.deltaY);
    this.requestRender();
    this.emitVisibleRange();
    this.notifyViewChange();
    this.updateCrosshair(point.x, point.y);
  };

  private render(): void {
    if (this.disposed) {
      return;
    }

    for (const pane of this.panes) {
      for (const indicator of pane.indicators) {
        if (indicator.isDirty()) {
          indicator.recompute();
        }
      }
    }

    const model = this.buildModel();
    if (!model) {
      return;
    }

    for (const pane of this.panes) {
      if (!pane.priceScale.isAutoScale()) {
        continue;
      }
      const range = this.visiblePanePriceRange(pane);
      if (range) {
        pane.priceScale.setAutoRange(range.min, range.max);
      }
    }

    this.renderer.renderAll(model);

    if (!this.readyEmitted) {
      this.readyEmitted = true;
      this.bus.emit("ready", undefined);
    }
  }

  private buildModel(): ChartRenderModel | null {
    const panes: PaneRenderModel[] = [];

    for (const pane of this.panes) {
      if (!pane.plot) {
        return null;
      }
      panes.push({
        paneId: pane.id,
        plot: pane.plot,
        priceScale: pane.priceScale,
        series: pane.series.map((series) => series.toRenderData()),
        indicators: pane.indicators.map((indicator) => indicator.toRenderData()),
      });
    }

    if (panes.length === 0) {
      return null;
    }

    const timeOptions = this.timeScaleModel.getOptions();

    return {
      width: this.stack.getWidth(),
      height: this.stack.getHeight(),
      panes,
      timeScale: this.timeScaleModel,
      layout: this.options.layout,
      grid: this.options.grid,
      crosshair: this.options.crosshair,
      crosshairPoint: this.crosshairPoint,
      locale: this.options.locale,
      timezone: this.options.timezone,
      timeVisible: timeOptions.timeVisible,
      secondsVisible: timeOptions.secondsVisible,
      axisWidth: AXIS_WIDTH,
      axisHeight: TIME_AXIS_HEIGHT,
    };
  }

  private visiblePanePriceRange(pane: Pane): { min: number; max: number } | null {
    const range = this.timeScaleModel.visibleIndexRange();
    if (range.last < range.first) {
      return null;
    }

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const series of pane.series) {
      if (!series.isVisible()) {
        continue;
      }
      const store = series.getStore();
      if (store.length === 0) {
        continue;
      }
      const minMax = store.minMax(range.first, range.last);
      if (!minMax) {
        continue;
      }
      if (minMax.min < min) {
        min = minMax.min;
      }
      if (minMax.max > max) {
        max = minMax.max;
      }
    }

    for (const indicator of pane.indicators) {
      const minMax = indicator.minMax(range.first, range.last);
      if (!minMax) {
        continue;
      }
      if (minMax.min < min) {
        min = minMax.min;
      }
      if (minMax.max > max) {
        max = minMax.max;
      }
    }

    return min === Number.POSITIVE_INFINITY ? null : { min, max };
  }

  private primaryStore(): OhlcStore | null {
    return this.primarySeries()?.getStore() ?? null;
  }

  private emitVisibleRange(): void {
    if (this.disposed) {
      return;
    }

    const range = this.timeScaleModel.getVisibleRange();
    this.bus.emit("visible-range", {
      from: range.from,
      to: range.to,
      paneId: "main",
    });
  }

  private updateCrosshair(x: number, y: number): void {
    if (this.disposed) {
      return;
    }

    const pane = this.paneAtPoint({ x, y });
    if (this.options.crosshair.mode === "hidden" || !pane || !pane.plot) {
      this.clearCrosshair();
      return;
    }

    const store = this.primaryStore();
    let time: number | null = null;
    let price: number | null = pane.priceScale.yToPrice(y, pane.plot.top, pane.plot.height);

    if (store && store.length > 0) {
      const index = Math.round(this.timeScaleModel.xToIndex(x));
      if (index >= 0 && index < store.length) {
        time = store.timeAt(index);

        if (this.options.crosshair.mode === "magnet") {
          const snapStore = pane.series[0]?.getStore();
          if (snapStore && snapStore.length > 0) {
            const snapIndex = Math.round(this.timeScaleModel.xToIndex(x));
            if (snapIndex >= 0 && snapIndex < snapStore.length) {
              price = snapStore.closeAt(snapIndex);
            }
          }
        }
      }
    }

    this.crosshairPoint = { paneId: pane.id, point: { x, y } };
    this.requestRender();
    this.bus.emit("crosshair", {
      time,
      price,
      paneId: pane.id,
      point: { x, y },
    });
  }

  private clearCrosshair(): void {
    if (this.crosshairPoint === null) {
      return;
    }

    const paneId = this.crosshairPoint.paneId;
    this.crosshairPoint = null;
    this.requestRender();
    this.bus.emit("crosshair", {
      time: null,
      price: null,
      paneId,
      point: null,
    });
  }

  private emitClick(point: Point): void {
    const pane = this.paneAtPoint(point);
    if (!pane || !pane.plot) {
      return;
    }

    const store = this.primaryStore();
    let time: number | null = null;

    if (store && store.length > 0) {
      const index = Math.round(this.timeScaleModel.xToIndex(point.x));
      if (index >= 0 && index < store.length) {
        time = store.timeAt(index);
      }
    }

    const price = pane.priceScale.yToPrice(point.y, pane.plot.top, pane.plot.height);
    this.bus.emit("click", {
      time,
      price,
      paneId: pane.id,
      point,
      button: "left",
    });
  }

  private localPoint(event: { clientX: number; clientY: number }): Point {
    const rect = this.stack.root.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  private paneAtY(y: number): Pane | null {
    for (const pane of this.panes) {
      if (!pane.plot) {
        continue;
      }
      if (y >= pane.plot.top && y <= pane.plot.bottom) {
        return pane;
      }
    }
    return null;
  }

  private paneAtPoint(point: Point): Pane | null {
    const pane = this.paneAtY(point.y);
    if (!pane || !pane.plot) {
      return null;
    }
    if (point.x < pane.plot.left || point.x > pane.plot.right) {
      return null;
    }
    return pane;
  }

  private setupObserver(): void {
    this.teardownObserver();

    if (!this.options.autoSize || typeof ResizeObserver === "undefined") {
      return;
    }

    this.observer = new ResizeObserver(() => {
      this.resize();
    });
    this.observer.observe(this.container);
  }

  private teardownObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private attachEvents(): void {
    const root = this.stack.root;
    root.addEventListener("pointerdown", this.onPointerDown);
    root.addEventListener("pointermove", this.onPointerMove);
    root.addEventListener("pointerup", this.onPointerUp);
    root.addEventListener("pointercancel", this.onPointerCancel);
    root.addEventListener("pointerleave", this.onPointerLeave);
    root.addEventListener("keydown", this.onKeyDown);
    root.addEventListener("wheel", this.onWheel, { passive: false });
  }

  private detachEvents(): void {
    const root = this.stack.root;
    root.removeEventListener("pointerdown", this.onPointerDown);
    root.removeEventListener("pointermove", this.onPointerMove);
    root.removeEventListener("pointerup", this.onPointerUp);
    root.removeEventListener("pointercancel", this.onPointerCancel);
    root.removeEventListener("pointerleave", this.onPointerLeave);
    root.removeEventListener("keydown", this.onKeyDown);
    root.removeEventListener("wheel", this.onWheel);
  }
}

function computePaneHeights(panes: readonly Pane[], available: number): number[] {
  if (panes.length === 0) {
    return [];
  }

  const preferred = panes.map((pane) => pane.preferredHeight);
  const autoCount = preferred.filter((height) => height === null).length;
  let heights: number[];

  if (autoCount === 0) {
    const sum = preferred.reduce((total: number, height) => total + (height ?? 0), 0);
    const scale = sum > 0 ? available / sum : 0;
    heights = preferred.map((height) => (height ?? 0) * scale);
  } else {
    const fixedSum = preferred.reduce((total: number, height) => total + (height ?? 0), 0);
    const autoHeight = Math.max(0, available - fixedSum) / autoCount;
    heights = preferred.map((height) => height ?? autoHeight);
    const total = heights.reduce((sum: number, height) => sum + height, 0);
    if (total > available) {
      heights = heights.map((height) => (height * available) / total);
    }
  }

  const minimum = Math.min(40, available / Math.max(1, panes.length));
  heights = heights.map((height) => Math.max(minimum, height));

  const total = heights.reduce((sum: number, height) => sum + height, 0);
  if (total > 0) {
    heights = heights.map((height) => (height * available) / total);
  }

  return heights;
}

function resolveOptions(options: ChartOptions): ResolvedOptions {
  const autoSize = options.autoSize ?? true;
  const width = options.width ?? 0;
  const height = options.height ?? 0;

  if (
    !autoSize &&
    (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
  ) {
    fail("INVALID_ARGUMENT", "width and height are required when autoSize is false");
  }

  const locale = options.locale ?? "en-US";
  const timezone = options.timezone ?? "UTC";
  validateLocaleAndTimezone(locale, timezone);

  const fontSize = options.layout?.fontSize ?? 12;
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    fail("INVALID_ARGUMENT", "layout.fontSize must be a positive number");
  }

  return {
    autoSize,
    width,
    height,
    locale,
    timezone,
    layout: {
      background: options.layout?.background ?? "#ffffff",
      textColor: options.layout?.textColor ?? "#131722",
      fontSize,
    },
    grid: resolveGrid(options.grid),
    crosshair: resolveCrosshair(options.crosshair),
    timeScale: options.timeScale ?? {},
    priceScale: options.priceScale ?? {},
    extensions: validateExtensions(options.extensions ?? []),
  };
}

function mergeChartOptions(base: ChartOptions, patch: Partial<ChartOptions>): ChartOptions {
  const merged = mergeDefined(base, patch);

  merged.layout = mergeDefined<LayoutOptions>(base.layout ?? {}, patch.layout);
  merged.grid = {
    vertLines: mergeDefined(base.grid?.vertLines ?? {}, patch.grid?.vertLines),
    horzLines: mergeDefined(base.grid?.horzLines ?? {}, patch.grid?.horzLines),
  };
  merged.crosshair = mergeDefined<CrosshairOptions>(base.crosshair ?? {}, patch.crosshair);

  if (merged.crosshair) {
    merged.crosshair.vertLine = mergeDefined(
      base.crosshair?.vertLine ?? {},
      patch.crosshair?.vertLine,
    );
    merged.crosshair.horzLine = mergeDefined(
      base.crosshair?.horzLine ?? {},
      patch.crosshair?.horzLine,
    );
  }

  merged.timeScale = mergeDefined<TimeScaleOptions>(base.timeScale ?? {}, patch.timeScale);
  merged.priceScale = mergeDefined<PriceScaleOptions>(base.priceScale ?? {}, patch.priceScale);
  merged.extensions = base.extensions ?? [];

  return merged;
}

function resolveGrid(options: GridOptions | undefined): ResolvedGrid {
  return {
    vertColor: options?.vertLines?.color ?? "#eef0f3",
    vertVisible: options?.vertLines?.visible ?? true,
    horzColor: options?.horzLines?.color ?? "#eef0f3",
    horzVisible: options?.horzLines?.visible ?? true,
  };
}

function resolveCrosshair(options: CrosshairOptions | undefined): ResolvedCrosshair {
  const color = options?.color ?? "#9598a1";
  return {
    mode: options?.mode ?? "normal",
    color,
    vertColor: options?.vertLine?.color ?? color,
    horzColor: options?.horzLine?.color ?? color,
    labelBackground: options?.labelBackground ?? "#131722",
    vertVisible: options?.vertLine?.visible ?? true,
    horzVisible: options?.horzLine?.visible ?? true,
    vertWidth: options?.vertLine?.width ?? 1,
    horzWidth: options?.horzLine?.width ?? 1,
    vertStyle: options?.vertLine?.style ?? "dashed",
    horzStyle: options?.horzLine?.style ?? "dashed",
  };
}

function validateExtensions(extensions: readonly WickExtension[]): readonly WickExtension[] {
  if (!Array.isArray(extensions)) {
    fail("INVALID_ARGUMENT", "extensions must be an array");
  }

  const ids = new Set<string>();

  for (const extension of extensions) {
    const id = extension?.meta?.id;
    if (typeof id !== "string" || id.length === 0) {
      fail("INVALID_ARGUMENT", "extension.meta.id must be a non-empty string");
    }
    if (ids.has(id)) {
      fail("DUPLICATE_EXTENSION", `Duplicate extension id: ${id}`);
    }
    ids.add(id);
  }

  return extensions;
}

function validateLocaleAndTimezone(locale: string, timezone: string): void {
  try {
    const formatter = new Intl.DateTimeFormat(locale, { timeZone: timezone });
    formatter.format(0);
  } catch {
    fail("INVALID_ARGUMENT", `Invalid locale or timezone: ${locale} / ${timezone}`);
  }
}
