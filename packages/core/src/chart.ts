import type { OhlcStore } from "./data/ohlc-store";
import { fail, type WickError } from "./errors";
import { EventBus } from "./events";
import { CanvasStack } from "./render/canvas-stack";
import {
  ChartRenderer,
  TIME_AXIS_HEIGHT,
  type ChartRenderModel,
  type PlotRect,
  type ResolvedCrosshair,
  type ResolvedGrid,
  type ResolvedLayout,
} from "./render/chart-renderer";
import { PriceScale } from "./scale/price-scale";
import { TimeScale, type TimeScaleSource } from "./scale/time-scale";
import { CandlestickSeries, Series, type SeriesHost } from "./series";
import type {
  CandlestickSeriesOptions,
  ChartApi,
  ChartEventMap,
  ChartOptions,
  CrosshairOptions,
  GridOptions,
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
  private readonly series: Series[] = [];
  private readonly stack: CanvasStack;
  private readonly timeScaleModel: TimeScale;
  private readonly priceScale: PriceScale;
  private readonly renderer: ChartRenderer;
  private readonly timeScaleController: TimeScaleApi;
  private readonly priceScaleController: PriceScaleApi;

  private rawOptions: ChartOptions;
  private options: ResolvedOptions;
  private plot: PlotRect | null = null;
  private observer: ResizeObserver | null = null;
  private frame: number | null = null;
  private disposed = false;
  private readyEmitted = false;
  private seriesCounter = 0;
  private crosshairPoint: Point | null = null;
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
    this.priceScale = new PriceScale(this.options.priceScale);
    this.renderer = new ChartRenderer(this.stack, this.timeScaleModel, this.priceScale);

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

    this.priceScaleController = {
      getVisibleRange: () => {
        this.assertAlive();
        return this.priceScale.getVisibleRange();
      },
      setVisibleRange: (range) => {
        this.assertAlive();
        this.priceScale.setVisibleRange(range);
        this.requestRender();
      },
      setAutoScale: (enabled) => {
        this.assertAlive();
        this.priceScale.setAutoScale(enabled);
        this.requestRender();
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

    this.seriesCounter += 1;
    const series = new Series(
      this,
      `series-${this.seriesCounter}`,
      CandlestickSeries,
      options as CandlestickSeriesOptions | undefined,
    );
    this.series.push(series);
    this.timeScaleModel.onDataChanged();
    this.requestRender();

    return series as unknown as SeriesApi<TData, TOptions>;
  }

  addPane(_options?: PaneOptions): PaneApi {
    this.assertAlive();
    fail("NOT_IMPLEMENTED", "Panes are implemented in Phase 3");
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
      this.priceScale.setOptions(next.priceScale);
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

    const plotWidth = Math.max(1, width - AXIS_WIDTH);
    const plotHeight = Math.max(1, height - TIME_AXIS_HEIGHT);

    this.plot = {
      left: 0,
      top: 0,
      right: plotWidth,
      bottom: plotHeight,
      width: plotWidth,
      height: plotHeight,
    };

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

    for (const series of this.series) {
      series.destroyInternal();
    }

    this.bus.dispose();
    this.series.length = 0;
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

  onSeriesDataChanged(_series: Series): void {
    this.assertAlive();
    this.timeScaleModel.onDataChanged();
    this.requestRender();
    this.emitVisibleRange();
  }

  private notifyViewChange(): void {
    if (this.disposed) {
      return;
    }
    for (const series of this.series) {
      series.onViewChanged();
    }
  }

  priceScaleApi(): PriceScaleApi {
    this.assertAlive();
    return this.priceScaleController;
  }

  removeSeries(series: Series): void {
    const index = this.series.indexOf(series);
    if (index < 0) {
      return;
    }

    this.series.splice(index, 1);
    this.timeScaleModel.onDataChanged();
    this.requestRender();
    this.emitVisibleRange();
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }

    const point = this.localPoint(event);
    if (!this.isInPlot(point)) {
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    this.dragging = true;
    this.pointerId = event.pointerId;
    this.dragLastX = point.x;
    this.dragMoved = false;

    try {
      this.stack.root.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort.
    }

    this.updateCrosshair(point.x, point.y);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const point = this.localPoint(event);

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

    if (!this.dragMoved && this.isInPlot(point)) {
      this.emitClick(point);
    }

    this.updateCrosshair(point.x, point.y);
  };

  private readonly onPointerCancel = (): void => {
    this.dragging = false;
    this.pointerId = null;
    this.clearCrosshair();
  };

  private readonly onPointerLeave = (): void => {
    if (!this.dragging) {
      this.clearCrosshair();
    }
  };

  private readonly onWheel = (event: WheelEvent): void => {
    const point = this.localPoint(event);
    if (!this.isInPlot(point)) {
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

    const model = this.buildModel();
    if (!model) {
      return;
    }

    if (this.priceScale.isAutoScale()) {
      const range = this.visiblePriceRange();
      if (range) {
        this.priceScale.setAutoRange(range.min, range.max);
      }
    }

    this.renderer.renderAll(model);

    if (!this.readyEmitted) {
      this.readyEmitted = true;
      this.bus.emit("ready", undefined);
    }
  }

  private buildModel(): ChartRenderModel | null {
    if (!this.plot) {
      return null;
    }

    const timeOptions = this.timeScaleModel.getOptions();

    return {
      width: this.stack.getWidth(),
      height: this.stack.getHeight(),
      plot: this.plot,
      axisWidth: AXIS_WIDTH,
      axisHeight: TIME_AXIS_HEIGHT,
      timeScale: this.timeScaleModel,
      priceScale: this.priceScale,
      series: this.series.map((series) => series.toRenderData()),
      layout: this.options.layout,
      grid: this.options.grid,
      crosshair: this.options.crosshair,
      crosshairPoint: this.crosshairPoint,
      locale: this.options.locale,
      timezone: this.options.timezone,
      timeVisible: timeOptions.timeVisible,
      secondsVisible: timeOptions.secondsVisible,
    };
  }

  private visiblePriceRange(): { min: number; max: number } | null {
    const range = this.timeScaleModel.visibleIndexRange();
    if (range.last < range.first) {
      return null;
    }

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const series of this.series) {
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

    return min === Number.POSITIVE_INFINITY ? null : { min, max };
  }

  private primaryStore(): OhlcStore | null {
    return this.series[0]?.getStore() ?? null;
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

    if (this.options.crosshair.mode === "hidden" || !this.plot || !this.isInPlot({ x, y })) {
      this.clearCrosshair();
      return;
    }

    const store = this.primaryStore();
    let time: number | null = null;
    let price: number | null = this.priceScale.yToPrice(y, this.plot.top, this.plot.height);

    if (store && store.length > 0) {
      const index = Math.round(this.timeScaleModel.xToIndex(x));
      if (index >= 0 && index < store.length) {
        time = store.timeAt(index);
        if (this.options.crosshair.mode === "magnet") {
          price = store.closeAt(index);
        }
      }
    }

    this.crosshairPoint = { x, y };
    this.requestRender();
    this.bus.emit("crosshair", {
      time,
      price,
      paneId: "main",
      point: { x, y },
    });
  }

  private clearCrosshair(): void {
    if (this.crosshairPoint === null) {
      return;
    }

    this.crosshairPoint = null;
    this.requestRender();
    this.bus.emit("crosshair", {
      time: null,
      price: null,
      paneId: "main",
      point: null,
    });
  }

  private emitClick(point: Point): void {
    if (!this.plot) {
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

    const price = this.priceScale.yToPrice(point.y, this.plot.top, this.plot.height);
    this.bus.emit("click", {
      time,
      price,
      paneId: "main",
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

  private isInPlot(point: Point): boolean {
    const plot = this.plot;
    return (
      plot !== null &&
      point.x >= plot.left &&
      point.x <= plot.right &&
      point.y >= plot.top &&
      point.y <= plot.bottom
    );
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
    root.addEventListener("wheel", this.onWheel, { passive: false });
  }

  private detachEvents(): void {
    const root = this.stack.root;
    root.removeEventListener("pointerdown", this.onPointerDown);
    root.removeEventListener("pointermove", this.onPointerMove);
    root.removeEventListener("pointerup", this.onPointerUp);
    root.removeEventListener("pointercancel", this.onPointerCancel);
    root.removeEventListener("pointerleave", this.onPointerLeave);
    root.removeEventListener("wheel", this.onWheel);
  }
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
