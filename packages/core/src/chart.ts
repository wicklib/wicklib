import type { SeriesDataStore } from "./data/series-store";
import { fail, WickError } from "./errors";
import { Drawing, type DrawingHost } from "./drawing";
import {
  anchorPoints,
  DRAWING_TOOLS,
  hitTestAnchor,
  hitTestDrawing,
  resolveDrawingOptions,
  type DrawingGeometryPane,
} from "./drawings";
import { EventBus } from "./events";
import { Indicator } from "./indicator";
import { Pane, type PaneHost } from "./pane";
import type { RendererBackend } from "./render/backend";
import { Canvas2DRenderer } from "./render/canvas2d-renderer";
import { WebGL2Renderer } from "./render/webgl2-renderer";
import {
  timeAxisHeight,
  type ChartRenderModel,
  type CrosshairRenderPoint,
  type OverlayRenderData,
  type PaneRenderModel,
  type ResolvedCrosshair,
  type DrawingRenderData,
  type ResolvedGrid,
  type ResolvedLayout,
} from "./render/chart-renderer";
import { TimeScale, type TimeScaleSource, type TimeScaleView } from "./scale/time-scale";
import { Series, type PriceLineHandle, type SeriesHost } from "./series";
import type {
  AddDrawingOptions,
  AddIndicatorOptions,
  ChartApi,
  ChartEventMap,
  ChartOptions,
  ChartOverlay,
  ChartOverlayApi,
  CrosshairOptions,
  DrawingAnchor,
  DrawingApi,
  DrawingDocument,
  DrawingOptions,
  DrawingToolDefinition,
  GridOptions,
  IndicatorApi,
  IndicatorDefinition,
  IndicatorInputs,
  InteractionOptions,
  LayoutOptions,
  PaneApi,
  PaneOptions,
  Point,
  PriceRange,
  PriceLineDragEvent,
  PriceScaleApi,
  PriceScaleOptions,
  SeriesApi,
  SeriesData,
  SelectDrawingOptions,
  SeriesOptions,
  SeriesType,
  SerializedDrawing,
  TimeScaleApi,
  TimeScaleOptions,
  Unsubscribe,
  VisibleRange,
  WickExtension,
} from "./types";
import { cancelFrame, mergeDefined, scheduleFrame } from "./util";

const DEFAULT_AXIS_WIDTH = 64;
const POSITION_ATR_PERIOD = 14;
const POSITION_RISK_REWARD = 2;
const POSITION_DEFAULT_WIDTH_BARS = 20;
const POSITION_FALLBACK_RISK = 0.01;
const MAGNET_DRAWING_RADIUS = 12;
const MAGNET_PRICE_LINE_RADIUS = 8;
const MIN_AXIS_WIDTH = 40;
const MAX_AXIS_WIDTH = 160;

interface ResolvedOptions {
  autoSize: boolean;
  width: number;
  height: number;
  locale: string;
  timezone: string;
  interval?: string;
  layout: ResolvedLayout;
  grid: ResolvedGrid;
  crosshair: ResolvedCrosshair;
  interaction: Required<InteractionOptions>;
  timeScale: TimeScaleOptions;
  priceScale: PriceScaleOptions;
  extensions: readonly WickExtension[];
}

interface OverlayEntry {
  id: string;
  paneId: string;
  overlay: ChartOverlay;
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
  private readonly drawingHost: DrawingHost;
  private readonly backend: RendererBackend;
  private readonly timeScaleModel: TimeScale;
  private readonly timeScaleController: TimeScaleApi;

  private rawOptions: ChartOptions;
  private options: ResolvedOptions;
  private axisWidth = DEFAULT_AXIS_WIDTH;
  private observer: ResizeObserver | null = null;
  private frame: number | null = null;
  private disposed = false;
  private readyEmitted = false;
  private seriesCounter = 0;
  private paneCounter = 0;
  private indicatorCounter = 0;
  private drawingCounter = 0;
  private readonly drawings: Drawing[] = [];
  private readonly drawingDefaultOptions = new Map<string, DrawingOptions>();
  private readonly overlays: OverlayEntry[] = [];
  private readonly selectedDrawingIds = new Set<string>();
  private hoveredDrawingId: string | null = null;
  private activeTool: DrawingToolDefinition | null = null;
  private activeDrawingOptions: DrawingOptions | undefined;
  private activeDrawingPaneId = "main";
  private pendingAnchors: DrawingAnchor[] = [];
  private previewPoint: Point | null = null;
  private lastFreehandPoint: Point | null = null;
  private freehandPointerId: number | null = null;
  private draggingDrawings: Drawing[] = [];
  private draggingAnchorIndex = -1;
  private drawingDragStart: Point | null = null;
  private drawingDragAnchors = new Map<string, DrawingAnchor[]>();
  private drawingDragMoved = false;
  private drawingDragPointerId: number | null = null;
  private marquee: {
    pointerId: number;
    paneId: string;
    start: Point;
    current: Point;
  } | null = null;
  private crosshairPoint: CrosshairRenderPoint | null = null;
  private lastPointerPoint: Point | null = null;
  private magnetModifierPressed = false;
  private shiftAnglePressed = false;
  private readonly activePointers = new Map<number, Point>();
  private pinchDistance: number | null = null;
  private dragging = false;
  private pointerId: number | null = null;
  private dragLastX = 0;
  private dragLastY = 0;
  private dragPane: Pane | null = null;
  private dragMoved = false;
  private priceAxisDrag: {
    pane: Pane;
    pointerId: number;
    startY: number;
    startRange: PriceRange;
    moved: boolean;
  } | null = null;
  private timeAxisDrag: {
    pointerId: number;
    startX: number;
    lastX: number;
    anchorX: number;
    moved: boolean;
  } | null = null;
  private priceLineDrag: {
    series: Series;
    key: string;
    paneId: string;
    originalPrice: number;
    currentPrice: number;
    pointerId: number;
    pointer: Point;
  } | null = null;
  private focusedPriceLine: {
    series: Series;
    key: string;
    originalPrice: number;
    currentPrice: number;
    active: boolean;
  } | null = null;

  constructor(container: HTMLElement, rawOptions: ChartOptions) {
    this.container = container;
    this.rawOptions = rawOptions;
    this.options = resolveOptions(rawOptions);

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
    this.backend = createRendererBackend(
      container,
      this.timeScaleModel,
      this.rawOptions.renderer ?? "canvas2d",
    );
    this.backend.root.style.touchAction = "none";
    this.backend.root.tabIndex = 0;
    this.backend.root.setAttribute("aria-label", "Chart");

    this.paneHost = {
      assertAlive: () => this.assertAlive(),
      requestRender: () => this.requestRender(),
      relayout: () => this.relayout(),
      removePane: (pane) => this.removePane(pane),
    };

    this.drawingHost = {
      assertAlive: () => this.assertAlive(),
      requestRender: () => this.requestRender(),
      emitUpdated: (drawing) => this.emitDrawingUpdated(drawing),
      removeDrawing: (drawing) => this.removeDrawing(drawing),
    };

    this.mainPane = new Pane("main", { priceScale: this.options.priceScale }, false, this.paneHost);
    this.panes.push(this.mainPane);

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
      getOptions: () => {
        this.assertAlive();
        return this.timeScaleModel.getOptions();
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

    const paneId = (options as SeriesOptions | undefined)?.paneId ?? "main";
    const pane = this.findPane(paneId);
    if (!pane) {
      fail("INVALID_ARGUMENT", `Unknown pane: ${paneId}`);
    }

    this.seriesCounter += 1;
    const series = new Series(this, `series-${this.seriesCounter}`, type, options, pane.id);
    pane.series.push(series);
    this.timeScaleModel.onDataChanged();
    this.requestRender();
    this.emitVisibleRange();

    return series as unknown as SeriesApi<TData, TOptions>;
  }

  getPanes(): readonly PaneApi[] {
    this.assertAlive();
    return [...this.panes];
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

    const primary = this.primaryOhlcSeries();
    if (!primary) {
      fail("INVALID_ARGUMENT", "Add a candlestick series before adding an indicator");
    }

    const sourceSeriesId = options?.sourceSeriesId ?? primary.id;
    if (sourceSeriesId !== primary.id) {
      fail("NOT_IMPLEMENTED", "Indicators currently support the primary candlestick series only");
    }

    const source = this.findSeries(sourceSeriesId);
    if (!source?.getOhlcStore()) {
      fail("INVALID_ARGUMENT", `Unknown candlestick source series: ${sourceSeriesId}`);
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
        getSourceStore: (seriesId) => this.findSeries(seriesId)?.getOhlcStore() ?? null,
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

  addDrawing(tool: DrawingToolDefinition, options: AddDrawingOptions): DrawingApi {
    this.assertAlive();
    const pane = this.resolveDrawingPane(options.paneId);
    const drawing = this.createDrawing(tool, pane, options.anchors, options.options);
    this.selectOnly(drawing);
    this.bus.emit("drawing-created", { drawing });
    return drawing;
  }

  addOverlay(overlay: ChartOverlay): ChartOverlayApi {
    this.assertAlive();
    if (
      !overlay ||
      typeof overlay.id !== "string" ||
      overlay.id.trim() === "" ||
      typeof overlay.draw !== "function"
    ) {
      fail("INVALID_ARGUMENT", "Overlay requires a non-empty id and draw function");
    }
    if (this.overlays.some((entry) => entry.id === overlay.id)) {
      fail("DUPLICATE_OVERLAY", `Duplicate overlay id: ${overlay.id}`);
    }
    const pane = this.resolveDrawingPane(overlay.paneId);
    const entry: OverlayEntry = { id: overlay.id, paneId: pane.id, overlay };
    this.overlays.push(entry);
    this.requestRender();
    return {
      id: entry.id,
      paneId: entry.paneId,
      requestRender: () => {
        this.requestRender();
      },
      remove: () => this.removeOverlay(entry),
    };
  }

  private removeOverlay(entry: OverlayEntry): void {
    const index = this.overlays.indexOf(entry);
    if (index < 0) {
      return;
    }
    this.overlays.splice(index, 1);
    this.requestRender();
  }

  private removeOverlaysForPane(paneId: string): void {
    for (let index = this.overlays.length - 1; index >= 0; index -= 1) {
      if (this.overlays[index]!.paneId === paneId) {
        this.overlays.splice(index, 1);
      }
    }
  }

  startDrawing(tool: DrawingToolDefinition, options?: Partial<AddDrawingOptions>): void {
    this.assertAlive();
    this.removeMeasureDrawings();
    if (this.activeTool) {
      this.cancelDrawing();
    }
    const pane = this.resolveDrawingPane(options?.paneId);
    this.activeTool = tool;
    this.activeDrawingOptions = options?.options;
    this.activeDrawingPaneId = pane.id;
    this.pendingAnchors = [];
    this.previewPoint = null;
    this.selectOnly(null);
    this.requestRender();
  }

  cancelDrawing(): void {
    if (!this.activeTool) {
      return;
    }
    const toolId = this.activeTool.id;
    this.resetDrawingTool();
    this.bus.emit("drawing-cancelled", { toolId });
    this.requestRender();
  }

  selectedDrawing(): DrawingApi | null {
    this.assertAlive();
    return this.selectedInternal();
  }

  selectedDrawings(): readonly DrawingApi[] {
    this.assertAlive();
    return this.orderedSelection();
  }

  private selectedInternal(): Drawing | null {
    return this.orderedSelection()[0] ?? null;
  }

  private orderedSelection(): Drawing[] {
    return this.drawings.filter((drawing) => this.selectedDrawingIds.has(drawing.id));
  }

  private drawingPane(pane: Pane): DrawingGeometryPane | null {
    if (!pane.plot) {
      return null;
    }
    return { plot: pane.plot, priceScale: pane.priceScale };
  }

  private isDrawingVisibleOnCurrentInterval(drawing: Drawing): boolean {
    const intervals = drawing.getOptions().visibleIntervals;
    if (intervals.length === 0) {
      return true;
    }
    const interval = this.currentInterval();
    return interval === null || intervals.includes(interval);
  }

  private currentInterval(): string | null {
    if (this.options.interval !== undefined) {
      return this.options.interval;
    }
    const datafeedInterval = this.primarySeries()?.getDatafeedOptions()?.interval;
    if (datafeedInterval) {
      return datafeedInterval;
    }
    const store = this.primaryStore();
    if (!store || store.length < 2) {
      return null;
    }
    const step = inferStoreInterval(store);
    return step === null ? null : inferIntervalLabel(step);
  }

  selectDrawing(id: string | null, options?: SelectDrawingOptions): void {
    this.assertAlive();
    if (id === null) {
      this.selectOnly(null);
      return;
    }
    const drawing = this.findDrawing(id);
    if (!drawing) {
      fail("INVALID_ARGUMENT", `Unknown drawing: ${id}`);
    }
    if (!this.isDrawingVisibleOnCurrentInterval(drawing)) {
      return;
    }
    const mode = options?.mode ?? "replace";
    if (mode === "replace") {
      this.selectOnly(drawing);
    } else if (mode === "add") {
      this.addToSelection([drawing]);
    } else {
      this.toggleSelection(drawing);
    }
  }

  selectNextDrawing(options?: SelectDrawingOptions): void {
    this.assertAlive();
    const eligible = this.drawings.filter((drawing) =>
      this.isDrawingVisibleOnCurrentInterval(drawing),
    );
    if (eligible.length === 0) {
      return;
    }
    const current = this.selectedInternal();
    const index = current ? eligible.indexOf(current) : -1;
    const next = eligible[(index + 1) % eligible.length]!;
    this.selectDrawing(next.id, options);
  }

  selectPreviousDrawing(options?: SelectDrawingOptions): void {
    this.assertAlive();
    const eligible = this.drawings.filter((drawing) =>
      this.isDrawingVisibleOnCurrentInterval(drawing),
    );
    if (eligible.length === 0) {
      return;
    }
    const current = this.selectedInternal();
    const index = current ? eligible.indexOf(current) : 0;
    const previous = eligible[(index - 1 + eligible.length) % eligible.length]!;
    this.selectDrawing(previous.id, options);
  }

  selectAllDrawings(options?: { visibleOnly?: boolean }): void {
    this.assertAlive();
    const visibleOnly = options?.visibleOnly ?? true;
    const drawings = visibleOnly
      ? this.drawings.filter(
          (drawing) =>
            drawing.getOptions().visible && this.isDrawingVisibleOnCurrentInterval(drawing),
        )
      : this.drawings;
    if (this.setSelection(drawings)) {
      this.emitSelection();
    }
  }

  updateSelectedDrawings(options: Partial<DrawingOptions>): void {
    this.assertAlive();
    for (const drawing of this.orderedSelection()) {
      drawing.setOptions(options);
    }
  }

  setDrawingDefaults(toolId: string, options: Partial<DrawingOptions>): void {
    this.assertAlive();
    if (!DRAWING_TOOLS.has(toolId)) {
      fail("INVALID_ARGUMENT", `Unknown drawing tool: ${toolId}`);
    }
    this.drawingDefaultOptions.set(
      toolId,
      mergeDefined<DrawingOptions>(this.drawingDefaultOptions.get(toolId) ?? {}, options),
    );
  }

  drawingDefaults(toolId: string): DrawingOptions {
    this.assertAlive();
    const tool = DRAWING_TOOLS.get(toolId);
    if (!tool) {
      fail("INVALID_ARGUMENT", `Unknown drawing tool: ${toolId}`);
    }
    return {
      ...resolveDrawingOptions(tool.defaultOptions, this.drawingDefaultOptions.get(toolId)),
    };
  }

  serializeDrawings(): DrawingDocument {
    this.assertAlive();
    const drawings: SerializedDrawing[] = [];
    for (const drawing of this.drawings) {
      const serialized = drawing.toSerialized();
      if (serialized) {
        drawings.push(serialized);
      }
    }
    return { version: 1, drawings };
  }

  loadDrawings(document: DrawingDocument): void {
    this.assertAlive();

    if (!document || document.version !== 1 || !Array.isArray(document.drawings)) {
      fail("INVALID_ARGUMENT", "Unsupported drawing document");
    }

    for (const drawing of this.drawings) {
      drawing.destroyInternal();
    }
    this.drawings.length = 0;
    this.selectedDrawingIds.clear();
    this.resetDrawingTool();

    const usedIds = new Set<string>();

    for (const item of document.drawings) {
      if (!item || typeof item.id !== "string" || usedIds.has(item.id)) {
        this.emitDrawingError(item?.id ?? "unknown", "Invalid or duplicate drawing id");
        continue;
      }

      const tool = DRAWING_TOOLS.get(item.toolId);
      if (!tool) {
        this.emitDrawingError(item.id, `Unknown drawing tool: ${item.toolId}`);
        continue;
      }

      const pane = this.findPane(item.paneId);
      if (!pane) {
        this.emitDrawingError(item.id, `Unknown pane: ${item.paneId}`);
        continue;
      }

      try {
        const drawing = new Drawing(
          item.id,
          item.paneId,
          tool,
          item.anchors,
          item.options,
          this.drawingHost,
        );
        this.drawings.push(drawing);
        usedIds.add(item.id);
      } catch (error) {
        this.emitDrawingError(item.id, error instanceof Error ? error.message : "Invalid drawing");
      }
    }

    this.emitSelection();
    this.requestRender();
  }

  private resolveDrawingPane(paneId: string | undefined): Pane {
    const id = paneId ?? "main";
    const pane = this.findPane(id);
    if (!pane) {
      fail("INVALID_ARGUMENT", `Unknown pane: ${id}`);
    }
    return pane;
  }

  private createDrawing(
    tool: DrawingToolDefinition,
    pane: Pane,
    anchors: readonly DrawingAnchor[],
    options: DrawingOptions | undefined,
  ): Drawing {
    const normalizedAnchors =
      tool.capture === "position" && anchors.length === 1
        ? this.positionAnchors(tool, pane, anchors[0]!)
        : anchors;
    const drawing = new Drawing(
      this.nextDrawingId(),
      pane.id,
      tool,
      normalizedAnchors,
      mergeDefined<DrawingOptions>(this.drawingDefaultOptions.get(tool.id) ?? {}, options),
      this.drawingHost,
    );
    this.drawings.push(drawing);
    return drawing;
  }

  private positionAnchors(
    tool: DrawingToolDefinition,
    pane: Pane,
    entry: DrawingAnchor,
  ): DrawingAnchor[] {
    const series =
      pane.series.find(
        (candidate) => candidate.kind === "candlestick" && candidate.getStore().length > 0,
      ) ?? pane.series.find((candidate) => candidate.getStore().length > 0);
    const store = series?.getOhlcStore() ?? null;
    const risk = this.initialPositionRisk(store, entry);
    const direction = tool.id === "short-position" ? -1 : 1;
    const stop = entry.price - direction * risk;
    const target = entry.price + direction * risk * POSITION_RISK_REWARD;
    const width = this.defaultPositionWidth(store, entry.time);
    return [
      entry,
      { time: entry.time, price: stop },
      { time: entry.time, price: target },
      { time: entry.time + width, price: entry.price },
    ];
  }

  private initialPositionRisk(
    store: ReturnType<Series["getOhlcStore"]>,
    entry: DrawingAnchor,
  ): number {
    if (store && store.length >= 2) {
      const end = store.nearestIndex(entry.time);
      if (end >= 0) {
        const start = Math.max(0, end - POSITION_ATR_PERIOD + 1);
        let total = 0;
        let count = 0;
        for (let index = start; index <= end; index += 1) {
          const bar = store.barAt(index);
          const previousClose = index > 0 ? store.closeAt(index - 1) : bar.open;
          const trueRange = Math.max(
            bar.high - bar.low,
            Math.abs(bar.high - previousClose),
            Math.abs(bar.low - previousClose),
          );
          if (Number.isFinite(trueRange)) {
            total += trueRange;
            count += 1;
          }
        }
        if (count > 0) {
          const atr = total / count;
          if (atr > 0) {
            return atr;
          }
        }
      }
    }
    return Math.max(Math.abs(entry.price) * POSITION_FALLBACK_RISK, 1e-6);
  }

  private defaultPositionWidth(store: ReturnType<Series["getOhlcStore"]>, time: number): number {
    let interval = 0;
    if (store && store.length > 1) {
      const index = store.nearestIndex(time);
      if (index >= 0) {
        const leftIndex = Math.max(0, Math.min(index, store.length - 2));
        interval = Math.abs(store.timeAt(leftIndex + 1) - store.timeAt(leftIndex));
      }
    }
    if (!Number.isFinite(interval) || interval <= 0) {
      const visible = this.timeScaleModel.getVisibleRange();
      interval = Math.max(1, (visible.to - visible.from) / POSITION_DEFAULT_WIDTH_BARS);
    }
    return interval * POSITION_DEFAULT_WIDTH_BARS;
  }

  private nextDrawingId(): string {
    this.drawingCounter += 1;
    let id = `drawing-${this.drawingCounter}`;
    while (this.drawings.some((drawing) => drawing.id === id)) {
      this.drawingCounter += 1;
      id = `drawing-${this.drawingCounter}`;
    }
    return id;
  }

  private findDrawing(id: string): Drawing | null {
    return this.drawings.find((drawing) => drawing.id === id) ?? null;
  }

  private selectOnly(drawing: Drawing | null): void {
    const next = drawing ? [drawing] : [];
    if (this.setSelection(next)) {
      this.emitSelection();
    }
  }

  private addToSelection(drawings: readonly Drawing[]): void {
    let changed = false;
    for (const drawing of drawings) {
      if (!this.selectedDrawingIds.has(drawing.id)) {
        this.selectedDrawingIds.add(drawing.id);
        changed = true;
      }
    }
    if (changed) {
      this.emitSelection();
    }
  }

  private toggleSelection(drawing: Drawing): void {
    if (this.selectedDrawingIds.has(drawing.id)) {
      this.selectedDrawingIds.delete(drawing.id);
    } else {
      this.selectedDrawingIds.add(drawing.id);
    }
    this.emitSelection();
  }

  private setSelection(drawings: readonly Drawing[]): boolean {
    const next = new Set(drawings.map((drawing) => drawing.id));
    if (
      next.size === this.selectedDrawingIds.size &&
      [...next].every((id) => this.selectedDrawingIds.has(id))
    ) {
      return false;
    }
    this.selectedDrawingIds.clear();
    for (const id of next) {
      this.selectedDrawingIds.add(id);
    }
    return true;
  }

  private emitSelection(): void {
    const drawings = this.orderedSelection();
    this.bus.emit("drawing-selection", { drawings });
    this.bus.emit("drawing-selected", { drawing: drawings[0] ?? null });
    if (drawings.length === 0) {
      this.backend.announce("Drawing selection cleared.");
    } else if (drawings.length === 1) {
      this.backend.announce(
        `${drawings[0]!.definition.meta.name} selected. Press Delete to remove.`,
      );
    } else {
      this.backend.announce(`${drawings.length} drawings selected. Press Delete to remove.`);
    }
    this.requestRender();
  }

  private removeMeasureDrawings(): void {
    for (let index = this.drawings.length - 1; index >= 0; index -= 1) {
      const drawing = this.drawings[index]!;
      if (drawing.toolId === "measure") {
        this.removeDrawing(drawing);
      }
    }
  }

  private removeDrawing(drawing: Drawing): void {
    const index = this.drawings.indexOf(drawing);
    if (index < 0) {
      return;
    }
    const wasSelected = this.selectedDrawingIds.delete(drawing.id);
    drawing.destroyInternal();
    this.drawings.splice(index, 1);
    this.resetDrawingDrag();
    if (wasSelected) {
      this.emitSelection();
    }
    this.bus.emit("drawing-removed", { drawingId: drawing.id });
    this.cleanupEmptyAutoPanes();
    this.relayout();
  }

  private removeDrawingsForPane(paneId: string): void {
    for (let index = this.drawings.length - 1; index >= 0; index -= 1) {
      const drawing = this.drawings[index]!;
      if (drawing.paneId !== paneId) {
        continue;
      }
      const wasSelected = this.selectedDrawingIds.delete(drawing.id);
      drawing.destroyInternal();
      this.drawings.splice(index, 1);
      if (wasSelected) {
        this.emitSelection();
      }
      this.bus.emit("drawing-removed", { drawingId: drawing.id });
    }
    this.resetDrawingDrag();
    this.requestRender();
  }

  private emitDrawingUpdated(drawing: Drawing): void {
    if (drawing.isRemoved()) {
      return;
    }
    this.bus.emit("drawing-updated", { drawing });
    this.requestRender();
  }

  private emitDrawingError(drawingId: string, message: string): void {
    this.bus.emit("error", {
      error: new WickError("INVALID_ARGUMENT", message, { drawingId }),
      source: "drawing",
      drawingId,
    });
  }

  private beginFreehand(pane: Pane, point: Point, event: PointerEvent): void {
    const tool = this.activeTool;
    const anchor = this.drawingAnchor(pane, point);
    if (!tool || !anchor) {
      return;
    }
    this.activeDrawingPaneId = pane.id;
    this.pendingAnchors = [anchor];
    this.previewPoint = point;
    this.lastFreehandPoint = point;
    this.freehandPointerId = event.pointerId;
    try {
      this.backend.root.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort.
    }
    this.clearCrosshair();
    this.requestRender();
  }

  private updateFreehand(point: Point, pointerId: number): void {
    if (pointerId !== this.freehandPointerId || !this.lastFreehandPoint) {
      return;
    }
    if (Math.hypot(point.x - this.lastFreehandPoint.x, point.y - this.lastFreehandPoint.y) < 2) {
      return;
    }
    const pane = this.findPane(this.activeDrawingPaneId);
    if (!pane) {
      return;
    }
    const anchor = this.drawingAnchor(pane, point);
    if (!anchor) {
      return;
    }
    this.pendingAnchors.push(anchor);
    this.previewPoint = point;
    this.lastFreehandPoint = point;
    this.requestRender();
  }

  private finishFreehand(): void {
    const tool = this.activeTool;
    const pane = this.findPane(this.activeDrawingPaneId);
    if (tool && pane && this.pendingAnchors.length >= 2) {
      const options = this.activeDrawingOptions;
      const drawing = this.createDrawing(tool, pane, this.pendingAnchors, options);
      this.resetDrawingTool();
      this.selectOnly(drawing);
      this.bus.emit("drawing-created", { drawing });
    } else {
      this.resetDrawingTool();
    }
    this.requestRender();
  }

  private finishPath(): void {
    const tool = this.activeTool;
    const pane = this.findPane(this.activeDrawingPaneId);
    if (tool && pane && this.pendingAnchors.length >= 2) {
      const options = this.activeDrawingOptions;
      const drawing = this.createDrawing(tool, pane, this.pendingAnchors, options);
      this.resetDrawingTool();
      this.selectOnly(drawing);
      this.bus.emit("drawing-created", { drawing });
    } else {
      this.resetDrawingTool();
    }
    this.requestRender();
  }

  private resetDrawingTool(): void {
    this.activeTool = null;
    this.activeDrawingOptions = undefined;
    this.activeDrawingPaneId = "main";
    this.pendingAnchors = [];
    this.previewPoint = null;
    this.lastFreehandPoint = null;
    this.freehandPointerId = null;
  }

  private buildDrawingRenderData(): DrawingRenderData[] {
    const result: DrawingRenderData[] = this.drawings
      .filter((drawing) => this.isDrawingVisibleOnCurrentInterval(drawing))
      .map((drawing) => ({
        id: drawing.id,
        toolId: drawing.toolId,
        paneId: drawing.paneId,
        anchors: drawing.getAnchorsInternal(),
        anchorCount: drawing.definition.anchors,
        previewPoint: null,
        options: drawing.getOptions(),
        selected: this.selectedDrawingIds.has(drawing.id),
        hovered: this.hoveredDrawingId === drawing.id,
        preview: false,
      }));

    if (this.activeTool && this.pendingAnchors.length > 0) {
      result.push({
        id: "__preview__",
        toolId: this.activeTool.id,
        paneId: this.activeDrawingPaneId,
        anchors: this.pendingAnchors,
        anchorCount:
          this.activeTool.capture === "freehand" || this.activeTool.capture === "path"
            ? Number.MAX_SAFE_INTEGER
            : this.activeTool.anchors,
        previewPoint:
          this.activeTool.capture === "freehand" || this.activeTool.capture === "path"
            ? this.previewPoint
            : this.activeTool.anchors > 1 && this.pendingAnchors.length < this.activeTool.anchors
              ? this.previewPoint
              : null,
        options: resolveDrawingOptions(this.activeTool.defaultOptions, this.activeDrawingOptions),
        selected: false,
        hovered: false,
        preview: true,
      });
    }

    return result;
  }

  private drawingAnchor(
    pane: Pane,
    point: Point,
    angleReference: DrawingAnchor | null = null,
  ): DrawingAnchor | null {
    if (!pane.plot) {
      return null;
    }

    const snapped = this.snapPointForMagnet(pane, point);
    let snappedPoint = snapped.point;
    let snappedTime = snapped.time;
    if (this.shiftAnglePressed && angleReference) {
      const reference = this.anchorScreenPoint(pane, angleReference);
      if (reference) {
        snappedPoint = constrainPointAngle(reference, snappedPoint);
        snappedTime = null;
      }
    }
    const time = snappedTime ?? this.timeScaleModel.timeAtX(snappedPoint.x);
    if (time === null) {
      return null;
    }

    const price = pane.priceScale.yToPrice(snappedPoint.y, pane.plot.top, pane.plot.height);
    return { time, price };
  }

  private screenPointToAnchor(pane: Pane, point: Point): DrawingAnchor | null {
    if (!pane.plot) {
      return null;
    }
    const time = this.timeScaleModel.timeAtX(point.x);
    if (time === null) {
      return null;
    }
    return {
      time,
      price: pane.priceScale.yToPrice(point.y, pane.plot.top, pane.plot.height),
    };
  }

  private anchorScreenPoint(pane: Pane, anchor: DrawingAnchor): Point | null {
    if (!pane.plot) {
      return null;
    }
    const x = this.timeScaleModel.timeToX(anchor.time);
    if (x === null) {
      return null;
    }
    return {
      x,
      y: pane.priceScale.priceToY(anchor.price, pane.plot.top, pane.plot.height),
    };
  }

  private previewPointForTool(pane: Pane, point: Point): Point {
    const tool = this.activeTool;
    if (!tool) {
      return point;
    }
    const snapped = this.snapPointForMagnet(pane, point).point;
    if (!this.shiftAnglePressed) {
      return snapped;
    }
    const referenceIndex = placementAngleReference(tool.id, this.pendingAnchors.length);
    const referenceAnchor =
      referenceIndex === null ? null : (this.pendingAnchors[referenceIndex] ?? null);
    if (!referenceAnchor) {
      return snapped;
    }
    const reference = this.anchorScreenPoint(pane, referenceAnchor);
    return reference ? constrainPointAngle(reference, snapped) : snapped;
  }

  private placeAnchor(pane: Pane, point: Point): void {
    if (!this.activeTool) {
      return;
    }

    if (this.pendingAnchors.length > 0 && pane.id !== this.activeDrawingPaneId) {
      return;
    }

    const referenceIndex = placementAngleReference(this.activeTool.id, this.pendingAnchors.length);
    const reference =
      referenceIndex === null ? null : (this.pendingAnchors[referenceIndex] ?? null);
    const anchor = this.drawingAnchor(pane, point, reference);
    if (!anchor) {
      return;
    }

    if (this.pendingAnchors.length === 0) {
      this.activeDrawingPaneId = pane.id;
    }

    if (this.activeTool.capture === "position") {
      const tool = this.activeTool;
      const options = this.activeDrawingOptions;
      const drawing = this.createDrawing(tool, pane, [anchor], options);
      this.resetDrawingTool();
      this.selectOnly(drawing);
      this.bus.emit("drawing-created", { drawing });
      this.requestRender();
      return;
    }

    this.pendingAnchors.push(anchor);
    this.previewPoint = point;

    if (this.activeTool.capture === "path") {
      this.requestRender();
      return;
    }

    if (this.pendingAnchors.length >= this.activeTool.anchors) {
      const tool = this.activeTool;
      const options = this.activeDrawingOptions;
      const targetPane = this.findPane(this.activeDrawingPaneId) ?? pane;
      const drawing = this.createDrawing(tool, targetPane, this.pendingAnchors, options);
      this.resetDrawingTool();
      this.selectOnly(drawing);
      this.bus.emit("drawing-created", { drawing });
      this.requestRender();
      return;
    }

    this.requestRender();
  }

  private hitTarget(drawing: Drawing) {
    return {
      toolId: drawing.toolId,
      anchors: drawing.getAnchorsInternal(),
      options: drawing.getOptions(),
    };
  }

  private tryStartDrawingDrag(pane: Pane, point: Point, event: PointerEvent): boolean {
    const geometry = this.drawingPane(pane);
    if (!geometry) {
      return false;
    }
    const modifier = event.metaKey || event.ctrlKey;
    const selected = this.selectedInternal();

    if (selected && selected.paneId === pane.id && !modifier) {
      const selectedTarget = this.hitTarget(selected);
      const handle = hitTestAnchor(selectedTarget, point, geometry, this.timeScaleModel);
      if (handle >= 0) {
        if (!selected.isLocked()) {
          this.beginDrawingDrag([selected], handle, point, event);
        }
        return true;
      }
    }

    for (let index = this.drawings.length - 1; index >= 0; index -= 1) {
      const drawing = this.drawings[index]!;
      if (drawing.paneId !== pane.id) {
        continue;
      }
      if (
        !this.isDrawingVisibleOnCurrentInterval(drawing) ||
        !hitTestDrawing(this.hitTarget(drawing), point, geometry, this.timeScaleModel)
      ) {
        continue;
      }

      if (modifier) {
        this.toggleSelection(drawing);
        return true;
      }

      if (this.selectedDrawingIds.has(drawing.id)) {
        const group = this.orderedSelection().filter((candidate) => !candidate.isLocked());
        this.beginDrawingDrag(group, -1, point, event);
        return true;
      }

      this.selectOnly(drawing);
      if (!drawing.isLocked()) {
        this.beginDrawingDrag([drawing], -1, point, event);
      }
      return true;
    }

    if (!modifier) {
      this.selectOnly(null);
    }
    return false;
  }

  private beginDrawingDrag(
    drawings: readonly Drawing[],
    anchorIndex: number,
    point: Point,
    event: PointerEvent,
  ): void {
    const movable = drawings.filter((drawing) => !drawing.isLocked());
    if (movable.length === 0) {
      return;
    }
    this.draggingDrawings = movable;
    this.draggingAnchorIndex = anchorIndex;
    this.drawingDragStart = point;
    this.drawingDragAnchors.clear();
    for (const drawing of movable) {
      this.drawingDragAnchors.set(
        drawing.id,
        drawing.getAnchors().map((anchor) => ({ ...anchor })),
      );
    }
    this.drawingDragMoved = false;
    this.drawingDragPointerId = event.pointerId;

    try {
      this.backend.root.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort.
    }

    this.clearCrosshair();
    this.requestRender();
  }

  private updateDrawingDrag(point: Point): void {
    const start = this.drawingDragStart;
    if (this.draggingDrawings.length === 0 || !start) {
      return;
    }

    const startTime = this.timeScaleModel.timeAtX(start.x);
    const currentTime = this.timeScaleModel.timeAtX(point.x);
    const timeDelta = (currentTime ?? startTime ?? 0) - (startTime ?? 0);

    for (const drawing of this.draggingDrawings) {
      const anchors = this.drawingDragAnchors.get(drawing.id);
      if (!anchors) {
        continue;
      }
      const pane = this.findPane(drawing.paneId);
      if (!pane || !pane.plot) {
        continue;
      }
      const next = anchors.map((anchor) => ({ ...anchor }));

      if (this.draggingAnchorIndex >= 0 && drawing.toolId === "parallel-channel") {
        const first = this.anchorScreenPoint(pane, anchors[0]!);
        const second = this.anchorScreenPoint(pane, anchors[1]!);
        const third = this.anchorScreenPoint(pane, anchors[2]!);
        if (!first || !second || !third) {
          continue;
        }
        const handle = this.draggingAnchorIndex;
        if (handle === 1) {
          const start = this.drawingDragStart ?? point;
          const startPrice = pane.priceScale.yToPrice(start.y, pane.plot.top, pane.plot.height);
          const currentPrice = pane.priceScale.yToPrice(point.y, pane.plot.top, pane.plot.height);
          const delta = currentPrice - startPrice;
          next[0] = { ...anchors[0]!, price: anchors[0]!.price + delta };
          next[1] = { ...anchors[1]!, price: anchors[1]!.price + delta };
        } else if (handle === 0 || handle === 2) {
          const baseIndex = first.x <= second.x ? (handle === 0 ? 0 : 1) : handle === 0 ? 1 : 0;
          const anchor = this.screenPointToAnchor(pane, point);
          if (anchor) {
            next[baseIndex] = anchor;
          }
        } else {
          const dx = second.x - first.x;
          const slope = Math.abs(dx) < 0.0001 ? 0 : (second.y - first.y) / dx;
          const baseAt = (x: number): number => first.y + slope * (x - first.x);
          const offset = point.y - baseAt(point.x);
          const newBottomY = baseAt(third.x) + offset;
          next[2] = {
            time: anchors[2]!.time,
            price: pane.priceScale.yToPrice(newBottomY, pane.plot.top, pane.plot.height),
          };
        }
        drawing.setAnchors(next);
        this.drawingDragMoved = true;
        continue;
      }
      if (this.draggingAnchorIndex >= 0 && drawing.toolId === "rectangle") {
        const first = this.anchorScreenPoint(pane, anchors[0]!);
        const second = this.anchorScreenPoint(pane, anchors[1]!);
        if (!first || !second) {
          continue;
        }
        let left = Math.min(first.x, second.x);
        let right = Math.max(first.x, second.x);
        let top = Math.min(first.y, second.y);
        let bottom = Math.max(first.y, second.y);
        const handle = this.draggingAnchorIndex;
        if (handle === 0 || handle === 6 || handle === 7) {
          left = point.x;
        }
        if (handle === 2 || handle === 3 || handle === 4) {
          right = point.x;
        }
        if (handle === 0 || handle === 1 || handle === 2) {
          top = point.y;
        }
        if (handle === 4 || handle === 5 || handle === 6) {
          bottom = point.y;
        }
        const topLeft = this.screenPointToAnchor(pane, { x: left, y: top });
        const bottomRight = this.screenPointToAnchor(pane, { x: right, y: bottom });
        if (topLeft && bottomRight) {
          drawing.setAnchors([topLeft, bottomRight]);
          this.drawingDragMoved = true;
        }
        continue;
      }
      if (this.draggingAnchorIndex >= 0) {
        const referenceIndex = dragAngleReference(drawing.toolId, this.draggingAnchorIndex);
        const referenceAnchor = referenceIndex === null ? null : (anchors[referenceIndex] ?? null);
        const anchor = this.drawingAnchor(pane, point, referenceAnchor);
        if (!anchor) {
          continue;
        }
        next[this.draggingAnchorIndex] = anchor;
        if (drawing.toolId === "horizontal-line") {
          next[this.draggingAnchorIndex] = {
            time: anchors[this.draggingAnchorIndex]!.time,
            price: anchor.price,
          };
        } else if (drawing.toolId === "vertical-line") {
          next[this.draggingAnchorIndex] = {
            time: anchor.time,
            price: anchors[this.draggingAnchorIndex]!.price,
          };
        } else if (
          (drawing.toolId === "long-position" || drawing.toolId === "short-position") &&
          (this.draggingAnchorIndex === 1 || this.draggingAnchorIndex === 2)
        ) {
          next[this.draggingAnchorIndex] = {
            time: anchors[this.draggingAnchorIndex]!.time,
            price: anchor.price,
          };
        } else if (
          (drawing.toolId === "long-position" || drawing.toolId === "short-position") &&
          this.draggingAnchorIndex === 3
        ) {
          next[this.draggingAnchorIndex] = {
            time: anchor.time,
            price: anchors[this.draggingAnchorIndex]!.price,
          };
        }
      } else {
        const startPrice = pane.priceScale.yToPrice(start.y, pane.plot.top, pane.plot.height);
        const currentPrice = pane.priceScale.yToPrice(point.y, pane.plot.top, pane.plot.height);
        const priceDelta = currentPrice - startPrice;
        for (let index = 0; index < next.length; index += 1) {
          next[index] = {
            time: next[index]!.time + timeDelta,
            price: next[index]!.price + priceDelta,
          };
        }
      }

      drawing.setAnchors(next);
      this.drawingDragMoved = true;
    }
  }

  private resetDrawingDrag(): void {
    this.draggingDrawings = [];
    this.draggingAnchorIndex = -1;
    this.drawingDragStart = null;
    this.drawingDragAnchors.clear();
    this.drawingDragMoved = false;
    this.drawingDragPointerId = null;
  }

  private finishMarquee(): void {
    const marquee = this.marquee;
    if (!marquee) {
      return;
    }
    const pane = this.findPane(marquee.paneId);
    if (!pane?.plot) {
      this.marquee = null;
      return;
    }
    const left = Math.min(marquee.start.x, marquee.current.x);
    const right = Math.max(marquee.start.x, marquee.current.x);
    const top = Math.min(marquee.start.y, marquee.current.y);
    const bottom = Math.max(marquee.start.y, marquee.current.y);
    const selected: Drawing[] = [];

    for (const drawing of this.drawings) {
      if (drawing.paneId !== pane.id) {
        continue;
      }
      const points = anchorPoints(
        drawing.getAnchorsInternal(),
        { plot: pane.plot, priceScale: pane.priceScale },
        this.timeScaleModel,
      );
      const visible = points.filter((point): point is Point => point !== null);
      if (visible.length === 0) {
        continue;
      }
      const minX = Math.min(...visible.map((point) => point.x));
      const maxX = Math.max(...visible.map((point) => point.x));
      const minY = Math.min(...visible.map((point) => point.y));
      const maxY = Math.max(...visible.map((point) => point.y));
      if (maxX >= left && minX <= right && maxY >= top && minY <= bottom) {
        selected.push(drawing);
      }
    }

    this.addToSelection(selected);
    this.marquee = null;
    this.requestRender();
  }

  resetView(): void {
    this.assertAlive();
    this.timeScaleModel.fitContent();
    for (const pane of this.panes) {
      pane.priceScale.setAutoScale(true);
    }
    this.requestRender();
    this.emitVisibleRange();
    this.notifyViewChange();
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
    if (patch.renderer !== undefined) {
      fail("INVALID_ARGUMENT", "renderer cannot be changed after chart creation");
    }

    const merged = mergeChartOptions(this.rawOptions, patch);
    const next = resolveOptions(merged);

    if (patch.priceScale !== undefined) {
      for (const pane of this.panes) {
        pane.priceScale.setOptions(next.priceScale);
      }
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

  takeScreenshot(): HTMLCanvasElement {
    this.assertAlive();
    if (this.frame !== null) {
      cancelFrame(this.frame);
      this.frame = null;
      this.render();
    }
    return this.backend.compose();
  }

  exportImage(type = "image/png", quality?: number): string {
    const screenshot = this.takeScreenshot();
    if (quality === undefined) {
      return screenshot.toDataURL(type);
    }
    if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
      fail("INVALID_ARGUMENT", "Image quality must be in [0, 1]");
    }
    return screenshot.toDataURL(type, quality);
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
      this.backend.root.style.width = "100%";
      this.backend.root.style.height = "100%";
    } else {
      this.backend.root.style.width = `${width}px`;
      this.backend.root.style.height = `${height}px`;
    }

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    this.backend.resize(width, height, dpr);
    this.relayout();
  }

  private relayout(): void {
    if (this.disposed) {
      return;
    }

    const width = this.backend.getWidth();
    const height = this.backend.getHeight();
    if (width <= 0 || height <= 0) {
      return;
    }

    const plotWidth = Math.max(1, width - this.axisWidth);
    const availableHeight = Math.max(1, height - this.computeAxisHeight());
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

    for (const drawing of this.drawings) {
      drawing.destroyInternal();
    }
    this.drawings.length = 0;
    this.overlays.length = 0;
    this.resetDrawingDrag();
    this.activePointers.clear();
    this.pinchDistance = null;
    this.timeAxisDrag = null;
    this.marquee = null;
    this.bus.dispose();
    this.panes.length = 0;
    this.backend.destroy();
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

  captureTimeView(): TimeScaleView {
    return this.timeScaleModel.captureView();
  }

  restoreTimeView(view: TimeScaleView): void {
    this.timeScaleModel.restoreView(view);
    this.requestRender();
  }

  isAtRightEdge(): boolean {
    return this.timeScaleModel.isAtRightEdge();
  }

  fitContent(): void {
    this.timeScaleModel.fitContent();
    this.requestRender();
    this.emitVisibleRange();
  }

  fitContentIfDefault(): void {
    if (this.timeScaleModel.hasExplicitRange()) {
      return;
    }
    this.fitContent();
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
      if (
        pane.autoCreated &&
        pane.series.length === 0 &&
        pane.indicators.length === 0 &&
        !this.drawings.some((drawing) => drawing.paneId === pane.id) &&
        !this.overlays.some((overlay) => overlay.paneId === pane.id)
      ) {
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

    this.removeDrawingsForPane(pane.id);
    this.removeOverlaysForPane(pane.id);

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

  private primaryOhlcSeries(): Series | null {
    for (const pane of this.panes) {
      const series = pane.series.find((candidate) => candidate.kind === "candlestick");
      if (series) {
        return series;
      }
    }
    return null;
  }

  focusPriceLine(series: Series, key: string): void {
    const entry = series.priceLineHandle(key);
    if (!entry) {
      return;
    }
    this.focusedPriceLine = {
      series,
      key,
      originalPrice: entry.options.price,
      currentPrice: entry.options.price,
      active: false,
    };
    try {
      this.backend.root.focus({ preventScroll: true });
    } catch {
      // Focus is best-effort.
    }
  }

  priceLineRemoved(series: Series, key: string): void {
    if (this.priceLineDrag?.series === series && this.priceLineDrag.key === key) {
      try {
        this.backend.root.releasePointerCapture(this.priceLineDrag.pointerId);
      } catch {
        // Pointer capture is best-effort.
      }
      this.priceLineDrag = null;
      this.backend.root.style.cursor = "crosshair";
    }
    if (this.focusedPriceLine?.series === series && this.focusedPriceLine.key === key) {
      this.focusedPriceLine = null;
    }
  }

  private emitIndicatorError(indicatorId: string, error: WickError): void {
    this.bus.emit("error", { error, source: "indicator", indicatorId });
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }
    if (!this.activeTool) {
      this.removeMeasureDrawings();
    }

    try {
      this.backend.root.focus({ preventScroll: true });
    } catch {
      // Focus is best-effort.
    }

    const point = this.localPoint(event);
    this.lastPointerPoint = point;
    this.magnetModifierPressed = event.metaKey || event.ctrlKey;
    this.shiftAnglePressed = event.shiftKey;
    this.shiftAnglePressed = event.shiftKey;
    const priceLinePane = this.paneAtPoint(point) ?? this.priceAxisPaneAtPoint(point);
    if (priceLinePane && this.tryStartPriceLineDrag(priceLinePane, point, event)) {
      return;
    }
    const axisPane = this.priceAxisPaneAtPoint(point);
    if (axisPane) {
      if (!this.options.interaction.axisDrag) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
      if (this.activeTool) {
        this.cancelDrawing();
      }
      this.clearCrosshair();
      this.resetDrawingDrag();
      this.dragging = false;
      this.pointerId = null;
      this.timeAxisDrag = null;
      this.priceAxisDrag = {
        pane: axisPane,
        pointerId: event.pointerId,
        startY: point.y,
        startRange: axisPane.priceScale.getVisibleRange(),
        moved: false,
      };
      this.backend.root.style.cursor = "ns-resize";
      try {
        this.backend.root.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort.
      }
      this.requestRender();
      return;
    }

    if (this.timeAxisPaneAtPoint(point)) {
      if (!this.options.interaction.axisDrag) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
      if (this.activeTool) {
        this.cancelDrawing();
      }
      this.clearCrosshair();
      this.resetDrawingDrag();
      this.dragging = false;
      this.pointerId = null;
      this.priceAxisDrag = null;
      this.timeAxisDrag = {
        pointerId: event.pointerId,
        startX: point.x,
        lastX: point.x,
        anchorX: point.x,
        moved: false,
      };
      this.backend.root.style.cursor = "ew-resize";
      try {
        this.backend.root.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort.
      }
      return;
    }

    const pane = this.paneAtPoint(point);
    if (!pane) {
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    if (this.activeTool) {
      if (this.activeTool.capture === "freehand") {
        this.beginFreehand(pane, point, event);
      } else {
        this.placeAnchor(pane, point);
      }
      return;
    }

    this.activePointers.set(event.pointerId, point);

    try {
      this.backend.root.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort.
    }

    if (this.activePointers.size === 2) {
      this.dragging = false;
      this.pointerId = null;
      this.pinchDistance = this.options.interaction.pinch ? this.currentPinchDistance() : null;
      this.resetDrawingDrag();
      this.clearCrosshair();
      return;
    }

    if (this.tryStartDrawingDrag(pane, point, event)) {
      this.dragging = false;
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      this.dragging = false;
      this.pointerId = null;
      this.marquee = {
        pointerId: event.pointerId,
        paneId: pane.id,
        start: point,
        current: point,
      };
      this.clearCrosshair();
      this.requestRender();
      return;
    }

    if (!this.options.interaction.drag) {
      this.dragging = false;
      this.pointerId = null;
      this.dragPane = null;
      this.updateCrosshair(point.x, point.y);
      return;
    }

    this.dragging = true;
    this.pointerId = event.pointerId;
    this.dragLastX = point.x;
    this.dragLastY = point.y;
    this.dragPane = pane;
    this.dragMoved = false;
    this.updateCrosshair(point.x, point.y);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const point = this.localPoint(event);
    this.lastPointerPoint = point;
    this.magnetModifierPressed = event.metaKey || event.ctrlKey;
    this.shiftAnglePressed = event.shiftKey;

    if (this.priceLineDrag && event.pointerId === this.priceLineDrag.pointerId) {
      this.updatePriceLineDrag(point);
      return;
    }

    if (this.timeAxisDrag && event.pointerId === this.timeAxisDrag.pointerId) {
      this.updateTimeAxisDrag(point);
      return;
    }

    if (this.priceAxisDrag && event.pointerId === this.priceAxisDrag.pointerId) {
      this.updatePriceAxisDrag(point);
      return;
    }

    if (this.activeTool) {
      if (this.activeTool.capture === "freehand") {
        this.updateFreehand(point, event.pointerId);
      } else {
        const previewPane = this.paneAtPoint(point) ?? this.findPane(this.activeDrawingPaneId);
        this.previewPoint = previewPane ? this.previewPointForTool(previewPane, point) : point;
        this.updateCrosshair(point.x, point.y);
        this.requestRender();
      }
      return;
    }

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

    if (this.draggingDrawings.length > 0 && event.pointerId === this.drawingDragPointerId) {
      this.updateDrawingDrag(point);
      return;
    }

    if (this.marquee && event.pointerId === this.marquee.pointerId) {
      this.marquee.current = point;
      this.requestRender();
      return;
    }

    if (this.dragging && event.pointerId === this.pointerId) {
      const deltaX = point.x - this.dragLastX;
      const deltaY = point.y - this.dragLastY;
      let changed = false;

      if (Math.abs(deltaX) >= 0.5) {
        this.dragMoved = true;
        this.dragLastX = point.x;
        this.timeScaleModel.pan(deltaX);
        changed = true;
      }
      if (Math.abs(deltaY) >= 0.5 && this.dragPane && !this.dragPane.priceScale.isAutoScale()) {
        this.dragMoved = true;
        this.dragLastY = point.y;
        this.panPanePrice(this.dragPane, deltaY);
        changed = true;
      }

      if (changed) {
        this.requestRender();
        this.emitVisibleRange();
        this.notifyViewChange();
      }
      this.updateCrosshair(point.x, point.y);
      return;
    }

    this.updateHoveredDrawing(point);
    this.updatePointerCursor(point);
    this.updateCrosshair(point.x, point.y);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);

    if (this.priceLineDrag && event.pointerId === this.priceLineDrag.pointerId) {
      this.finishPriceLineDrag();
      return;
    }

    if (this.timeAxisDrag && event.pointerId === this.timeAxisDrag.pointerId) {
      const point = this.localPoint(event);
      try {
        this.backend.root.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort.
      }
      this.timeAxisDrag = null;
      this.updatePointerCursor(point);
      return;
    }

    if (this.priceAxisDrag && event.pointerId === this.priceAxisDrag.pointerId) {
      const point = this.localPoint(event);
      try {
        this.backend.root.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort.
      }
      this.priceAxisDrag = null;
      this.updatePointerCursor(point);
      return;
    }

    if (this.activeTool) {
      if (this.activeTool.capture === "freehand" && event.pointerId === this.freehandPointerId) {
        try {
          this.backend.root.releasePointerCapture(event.pointerId);
        } catch {
          // Pointer capture is best-effort.
        }
        this.finishFreehand();
      }
      return;
    }

    if (this.draggingDrawings.length > 0 && event.pointerId === this.drawingDragPointerId) {
      const point = this.localPoint(event);
      try {
        this.backend.root.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort.
      }
      this.resetDrawingDrag();
      this.updateCrosshair(point.x, point.y);
      return;
    }

    if (this.marquee && event.pointerId === this.marquee.pointerId) {
      const point = this.localPoint(event);
      try {
        this.backend.root.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort.
      }
      this.finishMarquee();
      this.updatePointerCursor(point);
      return;
    }

    if (this.pinchDistance !== null) {
      try {
        this.backend.root.releasePointerCapture(event.pointerId);
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
    this.dragPane = null;

    try {
      this.backend.root.releasePointerCapture(event.pointerId);
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
    if (this.priceLineDrag && event.pointerId === this.priceLineDrag.pointerId) {
      this.cancelPriceLineDrag();
      return;
    }
    if (this.activePointers.size < 2) {
      this.pinchDistance = null;
    }
    this.dragging = false;
    this.pointerId = null;
    this.dragPane = null;
    this.priceAxisDrag = null;
    this.timeAxisDrag = null;
    this.marquee = null;
    if (this.activeTool?.capture === "freehand") {
      this.resetDrawingTool();
    }
    this.resetDrawingDrag();
    this.backend.root.style.cursor = "crosshair";
    this.clearCrosshair();
  };

  private readonly onPointerLeave = (): void => {
    this.lastPointerPoint = null;
    this.magnetModifierPressed = false;
    this.shiftAnglePressed = false;
    if (this.hoveredDrawingId !== null) {
      this.hoveredDrawingId = null;
      this.requestRender();
    }
    if (this.activeTool) {
      this.previewPoint = null;
      this.requestRender();
      return;
    }
    if (!this.priceAxisDrag) {
      this.backend.root.style.cursor = "crosshair";
    }
    if (
      !this.dragging &&
      this.pinchDistance === null &&
      this.draggingDrawings.length === 0 &&
      !this.priceAxisDrag &&
      !this.timeAxisDrag &&
      !this.marquee
    ) {
      this.clearCrosshair();
    }
  };

  private readonly onDoubleClick = (event: MouseEvent): void => {
    if (this.activeTool?.capture === "path") {
      if (this.pendingAnchors.length > 2) {
        this.pendingAnchors.pop();
      }
      if (this.pendingAnchors.length >= 2) {
        this.finishPath();
      } else {
        this.resetDrawingTool();
        this.requestRender();
      }
      event.preventDefault();
      return;
    }

    const point = this.localPoint(event);
    const drawingPane = this.paneAtPoint(point);
    if (drawingPane?.plot) {
      const geometry: DrawingGeometryPane = {
        plot: drawingPane.plot,
        priceScale: drawingPane.priceScale,
      };
      for (let index = this.drawings.length - 1; index >= 0; index -= 1) {
        const drawing = this.drawings[index]!;
        if (drawing.paneId !== drawingPane.id) {
          continue;
        }
        if (
          !this.isDrawingVisibleOnCurrentInterval(drawing) ||
          !hitTestDrawing(this.hitTarget(drawing), point, geometry, this.timeScaleModel)
        ) {
          continue;
        }
        this.selectOnly(drawing);
        this.bus.emit("drawing-double-click", { drawing, point });
        event.preventDefault();
        return;
      }
    }

    if (!this.options.interaction.axisDoubleClickReset) {
      return;
    }
    const pane = this.priceAxisPaneAtPoint(point);
    if (!pane) {
      return;
    }
    event.preventDefault();
    pane.priceScale.setAutoScale(true);
    this.requestRender();
    this.updateCrosshair(point.x, point.y);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.updateMagnetModifier(event.metaKey || event.ctrlKey);
    this.updateShiftAngleModifier(event.shiftKey);
    if (event.key === "Escape" && this.priceLineDrag?.pointerId === -1) {
      this.cancelPriceLineDrag();
      event.preventDefault();
      return;
    }
    if (event.key === "Escape" && this.priceLineDrag) {
      this.cancelPriceLineDrag();
      event.preventDefault();
      return;
    }
    if (this.handlePriceLineKey(event)) {
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      this.selectAllDrawings();
      event.preventDefault();
      return;
    }

    if (event.key === "]" || event.key === "[") {
      if (this.drawings.length > 0) {
        if (event.key === "]") {
          this.selectNextDrawing();
        } else {
          this.selectPreviousDrawing();
        }
        event.preventDefault();
      }
      return;
    }

    if (event.key === "Enter" && this.activeTool?.capture === "path") {
      if (this.pendingAnchors.length >= 2) {
        this.finishPath();
      }
      event.preventDefault();
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      const selected = this.orderedSelection();
      if (selected.length > 0) {
        for (const drawing of selected) {
          if (!drawing.isLocked()) {
            drawing.remove();
          }
        }
        event.preventDefault();
        return;
      }
    }

    if (event.key === "Escape") {
      if (this.activeTool) {
        this.cancelDrawing();
      } else if (this.selectedDrawingIds.size > 0) {
        this.selectDrawing(null);
      } else {
        this.clearCrosshair();
      }
      event.preventDefault();
      return;
    }

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
      default:
        return;
    }

    event.preventDefault();
    this.requestRender();
    this.emitVisibleRange();
    this.notifyViewChange();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.updateMagnetModifier(event.metaKey || event.ctrlKey);
    this.updateShiftAngleModifier(event.shiftKey);
  };

  private updateMagnetModifier(pressed: boolean): void {
    if (this.magnetModifierPressed === pressed) {
      return;
    }
    this.magnetModifierPressed = pressed;
    const point = this.lastPointerPoint;
    if (point) {
      this.updateCrosshair(point.x, point.y);
    }
  }

  private updateShiftAngleModifier(pressed: boolean): void {
    if (this.shiftAnglePressed === pressed) {
      return;
    }
    this.shiftAnglePressed = pressed;
    const point = this.lastPointerPoint;
    if (!point) {
      return;
    }
    if (this.activeTool && this.pendingAnchors.length > 0) {
      const pane = this.paneAtPoint(point);
      if (pane) {
        this.previewPoint = this.previewPointForTool(pane, point);
        this.requestRender();
      }
    }
    if (this.draggingDrawings.length > 0 && this.drawingDragPointerId !== null) {
      this.updateDrawingDrag(point);
    }
  }

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
    if (this.priceLineDrag || !this.options.interaction.wheel) {
      return;
    }
    const point = this.localPoint(event);
    if (!this.paneAtPoint(point)) {
      return;
    }

    event.preventDefault();

    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      if (event.deltaX === 0) {
        return;
      }
      this.timeScaleModel.pan(-event.deltaX);
    } else if (event.deltaY !== 0) {
      this.timeScaleModel.zoomAt(point.x, event.deltaY);
    } else {
      return;
    }

    this.requestRender();
    this.emitVisibleRange();
    this.notifyViewChange();
    this.updateCrosshair(point.x, point.y);
  };

  private render(): void {
    if (this.disposed) {
      return;
    }
    this.pruneTimeframeHiddenSelection();

    for (const pane of this.panes) {
      for (const indicator of pane.indicators) {
        if (indicator.isDirty()) {
          indicator.recompute();
        }
      }
    }

    let model = this.buildModel();
    if (!model) {
      return;
    }

    this.applyAutoScale();

    const axisWidth = this.computeAxisWidth();
    if (axisWidth !== this.axisWidth) {
      this.axisWidth = axisWidth;
      this.relayout();
      model = this.buildModel();
      if (!model) {
        return;
      }
      this.applyAutoScale();
    }

    this.backend.render(model);

    if (!this.readyEmitted) {
      this.readyEmitted = true;
      this.bus.emit("ready", undefined);
    }
  }

  private pruneTimeframeHiddenSelection(): void {
    if (this.selectedDrawingIds.size === 0) {
      return;
    }
    let changed = false;
    for (const id of [...this.selectedDrawingIds]) {
      const drawing = this.findDrawing(id);
      if (drawing && !this.isDrawingVisibleOnCurrentInterval(drawing)) {
        this.selectedDrawingIds.delete(id);
        changed = true;
      }
    }
    if (changed) {
      this.emitSelection();
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
      width: this.backend.getWidth(),
      height: this.backend.getHeight(),
      panes,
      overlays: this.overlays.map((entry): OverlayRenderData => ({
        id: entry.id,
        paneId: entry.paneId,
        overlay: entry.overlay,
      })),
      drawings: this.buildDrawingRenderData(),
      timeScale: this.timeScaleModel,
      layout: this.options.layout,
      grid: this.options.grid,
      crosshair: this.options.crosshair,
      crosshairPoint: this.crosshairPoint,
      selectionBox: this.marquee
        ? { start: this.marquee.start, current: this.marquee.current }
        : null,
      locale: this.options.locale,
      timezone: this.options.timezone,
      timeVisible: timeOptions.timeVisible,
      secondsVisible: timeOptions.secondsVisible,
      axisWidth: this.axisWidth,
      axisHeight: this.computeAxisHeight(),
    };
  }

  private applyAutoScale(): void {
    for (const pane of this.panes) {
      if (!pane.priceScale.isAutoScale()) {
        continue;
      }
      const range = this.visiblePanePriceRange(pane);
      if (range) {
        pane.priceScale.setAutoRange(range.min, range.max);
      }
    }
  }

  private computeAxisHeight(): number {
    return timeAxisHeight(this.options.layout.axisFontSize);
  }

  private computeAxisWidth(): number {
    const axisFont = `${this.options.layout.axisFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const drawingFont = `${this.options.layout.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const measure = (text: string): number => this.backend.measureText(text, axisFont);
    const measureDrawing = (text: string): number => this.backend.measureText(text, drawingFont);
    const visible = this.timeScaleModel.visibleIndexRange();
    let widest = 0;

    for (const pane of this.panes) {
      if (!pane.plot || pane.plot.height <= 0) {
        continue;
      }

      for (const tick of pane.priceScale.ticks(pane.plot.height)) {
        widest = Math.max(
          widest,
          measure(pane.priceScale.formatValue(tick.value, this.options.locale)),
        );
      }

      for (const series of pane.series) {
        if (!series.isVisible()) {
          continue;
        }
        const data = series.toRenderData();
        if (data.store.length > 0 && data.lastValueVisible) {
          const indices = new Set([data.store.length - 1]);
          if (data.lastValueMode !== "data") {
            indices.add(Math.min(visible.last, data.store.length - 1));
          }
          for (const index of indices) {
            if (index < 0) {
              continue;
            }
            widest = Math.max(
              widest,
              measure(pane.priceScale.formatValue(data.store.valueAt(index), this.options.locale)),
            );
          }
        }
        for (const line of data.priceLines) {
          if (!line.axisLabelVisible) {
            continue;
          }
          const value = pane.priceScale.formatValue(line.price, this.options.locale);
          const label =
            line.title && line.titlePosition === "axis" ? `${line.title} ${value}` : value;
          widest = Math.max(widest, measure(label));
        }
      }

      for (const drawing of this.drawings) {
        if (drawing.paneId !== pane.id) {
          continue;
        }
        const options = drawing.getOptions();
        const mode = options.priceLabels ?? "never";
        if (mode === "never" || (mode === "selected" && !this.selectedDrawingIds.has(drawing.id))) {
          continue;
        }
        if (drawing.toolId === "trend-line") {
          for (const anchor of drawing.getAnchorsInternal().slice(0, 2)) {
            widest = Math.max(
              widest,
              measureDrawing(pane.priceScale.formatValue(anchor.price, this.options.locale)),
            );
          }
        } else if (drawing.toolId === "long-position" || drawing.toolId === "short-position") {
          for (const anchor of drawing.getAnchorsInternal().slice(0, 3)) {
            widest = Math.max(
              widest,
              measure(pane.priceScale.formatValue(anchor.price, this.options.locale)),
            );
          }
        }
      }
    }

    return Math.min(MAX_AXIS_WIDTH, Math.max(MIN_AXIS_WIDTH, Math.ceil(widest + 16)));
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
      const minMax = series.priceRange(range.first, range.last);
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

  private primaryStore(): SeriesDataStore | null {
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

  private findPriceLineHandle(pane: Pane, point: Point): PriceLineHandle | null {
    const plot = pane.plot;
    if (!plot || point.x < plot.left || point.x > plot.right + this.axisWidth) {
      return null;
    }
    let nearest: { handle: PriceLineHandle; distance: number } | null = null;
    for (const series of pane.series) {
      if (!series.isVisible()) {
        continue;
      }
      for (const handle of series.priceLineHandles()) {
        if (!handle.options.draggable) {
          continue;
        }
        const y = pane.priceScale.priceToY(handle.options.price, plot.top, plot.height);
        const distance = Math.abs(point.y - y);
        if (distance > 6) {
          continue;
        }
        if (!nearest || distance < nearest.distance) {
          nearest = { handle, distance };
        }
      }
    }
    return nearest?.handle ?? null;
  }

  private tryStartPriceLineDrag(pane: Pane, point: Point, event: PointerEvent): boolean {
    const handle = this.findPriceLineHandle(pane, point);
    if (!handle || !pane.plot) {
      return false;
    }
    this.priceLineDrag = {
      series: handle.series,
      key: handle.key,
      paneId: pane.id,
      originalPrice: handle.options.price,
      currentPrice: handle.options.price,
      pointerId: event.pointerId,
      pointer: point,
    };
    this.focusedPriceLine = {
      series: handle.series,
      key: handle.key,
      originalPrice: handle.options.price,
      currentPrice: handle.options.price,
      active: false,
    };
    this.emitPriceLineDrag(
      handle,
      "start",
      handle.options.price,
      handle.options.price,
      point,
      "pointer",
    );
    this.clearCrosshair();
    this.backend.root.style.cursor = "ns-resize";
    try {
      this.backend.root.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort.
    }
    return true;
  }

  private updatePriceLineDrag(point: Point): void {
    const drag = this.priceLineDrag;
    if (!drag) {
      return;
    }
    const pane = this.findPane(drag.paneId);
    const handle = drag.series.priceLineHandle(drag.key);
    if (!pane?.plot || !handle) {
      this.cancelPriceLineDrag();
      return;
    }
    const raw = pane.priceScale.yToPrice(point.y, pane.plot.top, pane.plot.height);
    const price = this.normalizePriceLineDragPrice(pane, handle, raw, point);
    drag.pointer = point;
    if (price === drag.currentPrice) {
      return;
    }
    const previous = drag.currentPrice;
    drag.currentPrice = price;
    drag.series.setPriceLinePrice(drag.key, price);
    this.emitPriceLineDrag(handle, "move", price, previous, point, "pointer");
  }

  private finishPriceLineDrag(): void {
    const drag = this.priceLineDrag;
    if (!drag) {
      return;
    }
    const handle = drag.series.priceLineHandle(drag.key);
    if (handle) {
      this.emitPriceLineDrag(
        handle,
        "end",
        drag.currentPrice,
        drag.currentPrice,
        drag.pointer,
        "pointer",
      );
    }
    this.releasePriceLineDrag();
  }

  private cancelPriceLineDrag(): void {
    const drag = this.priceLineDrag;
    if (!drag) {
      return;
    }
    const handle = drag.series.priceLineHandle(drag.key);
    drag.series.setPriceLinePrice(drag.key, drag.originalPrice);
    if (handle) {
      this.emitPriceLineDrag(
        handle,
        "cancel",
        drag.originalPrice,
        drag.currentPrice,
        drag.pointer,
        drag.pointerId === -1 ? "keyboard" : "pointer",
      );
    }
    this.releasePriceLineDrag();
  }

  private releasePriceLineDrag(): void {
    const drag = this.priceLineDrag;
    if (drag) {
      try {
        this.backend.root.releasePointerCapture(drag.pointerId);
      } catch {
        // Pointer capture is best-effort.
      }
    }
    this.priceLineDrag = null;
    if (this.focusedPriceLine) {
      this.focusedPriceLine.active = false;
    }
    this.backend.root.style.cursor = "crosshair";
    this.requestRender();
  }

  private emitPriceLineDrag(
    handle: PriceLineHandle,
    phase: PriceLineDragEvent["phase"],
    price: number,
    previousPrice: number,
    pointer: Point,
    source: PriceLineDragEvent["source"],
  ): void {
    const event: PriceLineDragEvent = {
      id: handle.options.id,
      phase,
      price,
      previousPrice,
      originalPrice:
        this.priceLineDrag?.originalPrice ?? this.focusedPriceLine?.originalPrice ?? price,
      pointer: { ...pointer },
      source,
    };
    if (phase === "start") {
      handle.options.onDragStart?.(event);
    } else if (phase === "move") {
      handle.options.onDragMove?.(event);
    } else if (phase === "end") {
      handle.options.onDragEnd?.(event);
    } else {
      handle.options.onDragEnd?.(event);
    }
  }

  private normalizePriceLineDragPrice(
    pane: Pane,
    handle: PriceLineHandle,
    rawPrice: number,
    point: Point,
  ): number {
    let price = rawPrice;
    if (handle.options.dragSnap === "magnet") {
      price = this.magnetPriceForLineDrag(pane, point);
    } else if (handle.options.dragSnap === "tick") {
      price = this.roundPriceLine(pane, price);
    }
    price = this.roundPriceLine(pane, price);
    const constraint = handle.options.dragConstraint;
    const original =
      this.priceLineDrag?.originalPrice ??
      this.focusedPriceLine?.originalPrice ??
      handle.options.price;
    if (constraint.kind === "above") {
      price = Math.max(price, constraint.min ?? original);
    } else if (constraint.kind === "below") {
      price = Math.min(price, constraint.max ?? original);
    } else if (constraint.kind === "range") {
      if (constraint.min !== undefined) {
        price = Math.max(price, constraint.min);
      }
      if (constraint.max !== undefined) {
        price = Math.min(price, constraint.max);
      }
    }
    return this.roundPriceLine(pane, price);
  }

  private roundPriceLine(pane: Pane, price: number): number {
    const format = pane.priceScale.getOptions().priceFormat ?? {};
    const minMove = format.minMove;
    if (minMove !== undefined) {
      return Math.round(price / minMove) * minMove;
    }
    const precision = format.precision ?? pane.priceScale.precision();
    return Number(price.toFixed(precision));
  }

  private priceLineTickStep(pane: Pane): number {
    const format = pane.priceScale.getOptions().priceFormat ?? {};
    return format.minMove ?? 10 ** -(format.precision ?? pane.priceScale.precision());
  }

  private magnetPriceForLineDrag(pane: Pane, point: Point): number {
    let strength = this.activeMagnetStrength();
    if (strength === "off") {
      strength = "weak";
    }
    if (strength === "strong") {
      const anchor = this.nearestDrawingAnchor(pane, point);
      if (anchor) {
        return pane.priceScale.yToPrice(anchor.point.y, pane.plot!.top, pane.plot!.height);
      }
    }
    const ohlc = this.snapToOhlc(pane, point);
    return ohlc?.price ?? pane.priceScale.yToPrice(point.y, pane.plot!.top, pane.plot!.height);
  }

  private handlePriceLineKey(event: KeyboardEvent): boolean {
    const focused = this.focusedPriceLine;
    if (!focused) {
      return false;
    }
    const handle = focused.series.priceLineHandle(focused.key);
    if (!handle) {
      this.focusedPriceLine = null;
      return false;
    }
    const pane = this.findPane(focused.series.paneId);
    if (!pane?.plot) {
      return false;
    }
    if (event.key === "Escape") {
      if (focused.active) {
        focused.series.setPriceLinePrice(focused.key, focused.originalPrice);
        this.emitPriceLineDrag(
          handle,
          "cancel",
          focused.originalPrice,
          focused.currentPrice,
          this.lastPointerPoint ?? { x: pane.plot.right, y: 0 },
          "keyboard",
        );
        focused.active = false;
        this.releasePriceLineDrag();
      }
      event.preventDefault();
      return true;
    }
    if (event.key === "Enter") {
      if (focused.active) {
        this.emitPriceLineDrag(
          handle,
          "end",
          focused.currentPrice,
          focused.currentPrice,
          this.lastPointerPoint ?? { x: pane.plot.right, y: 0 },
          "keyboard",
        );
        focused.active = false;
        this.releasePriceLineDrag();
      }
      event.preventDefault();
      return true;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return false;
    }
    if (!focused.active) {
      focused.originalPrice = handle.options.price;
      focused.currentPrice = handle.options.price;
      focused.active = true;
      this.priceLineDrag = {
        series: focused.series,
        key: focused.key,
        paneId: pane.id,
        originalPrice: focused.originalPrice,
        currentPrice: focused.currentPrice,
        pointerId: -1,
        pointer: this.lastPointerPoint ?? { x: pane.plot.right, y: 0 },
      };
      this.emitPriceLineDrag(
        handle,
        "start",
        focused.currentPrice,
        focused.currentPrice,
        this.lastPointerPoint ?? { x: pane.plot.right, y: 0 },
        "keyboard",
      );
    }
    const step = this.priceLineTickStep(pane) * (event.shiftKey ? 10 : 1);
    const direction = event.key === "ArrowUp" ? 1 : -1;
    const next = this.normalizePriceLineDragPrice(
      pane,
      handle,
      focused.currentPrice + step * direction,
      this.lastPointerPoint ?? {
        x: pane.plot.right,
        y: pane.priceScale.priceToY(focused.currentPrice, pane.plot.top, pane.plot.height),
      },
    );
    if (next !== focused.currentPrice) {
      const previous = focused.currentPrice;
      focused.currentPrice = next;
      focused.series.setPriceLinePrice(focused.key, next);
      this.emitPriceLineDrag(
        handle,
        "move",
        next,
        previous,
        this.lastPointerPoint ?? { x: pane.plot.right, y: 0 },
        "keyboard",
      );
    }
    event.preventDefault();
    return true;
  }

  private updateHoveredDrawing(point: Point): void {
    if (this.activeTool || this.draggingDrawings.length > 0 || this.marquee) {
      if (this.hoveredDrawingId !== null) {
        this.hoveredDrawingId = null;
        this.requestRender();
      }
      return;
    }
    const pane = this.paneAtPoint(point);
    let next: string | null = null;
    if (pane?.plot) {
      const geometry: DrawingGeometryPane = {
        plot: pane.plot,
        priceScale: pane.priceScale,
      };
      for (let index = this.drawings.length - 1; index >= 0; index -= 1) {
        const drawing = this.drawings[index]!;
        if (drawing.paneId !== pane.id) {
          continue;
        }
        if (
          this.isDrawingVisibleOnCurrentInterval(drawing) &&
          hitTestDrawing(this.hitTarget(drawing), point, geometry, this.timeScaleModel)
        ) {
          next = drawing.id;
          break;
        }
      }
    }
    if (next !== this.hoveredDrawingId) {
      this.hoveredDrawingId = next;
      this.requestRender();
    }
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
    const snapped = this.snapPointForMagnet(pane, { x, y });
    const point = snapped.point;
    const price: number | null = pane.priceScale.yToPrice(point.y, pane.plot.top, pane.plot.height);

    if (store && store.length > 0) {
      const index = Math.round(this.timeScaleModel.xToIndex(point.x));
      if (index >= 0 && index < store.length) {
        time = store.timeAt(index);
      }
    }
    if (snapped.time !== null) {
      time = snapped.time;
    }

    this.crosshairPoint = { paneId: pane.id, point };
    this.requestRender();
    this.bus.emit("crosshair", {
      time,
      price,
      paneId: pane.id,
      point,
    });
  }

  private activeMagnetStrength(): "off" | "weak" | "strong" {
    if (this.magnetModifierPressed && this.options.crosshair.modifierMagnet !== "off") {
      return this.options.crosshair.modifierMagnet;
    }
    if (this.options.crosshair.mode === "magnet") {
      return this.options.crosshair.magnet;
    }
    return "off";
  }

  private snapPointForMagnet(pane: Pane, point: Point): { point: Point; time: number | null } {
    const strength = this.activeMagnetStrength();
    if (strength === "off" || !pane.plot) {
      return { point, time: null };
    }

    if (strength === "strong") {
      const anchor = this.nearestDrawingAnchor(pane, point);
      if (anchor) {
        return { point: anchor.point, time: anchor.time };
      }
      const priceLine = this.nearestPriceLine(pane, point);
      if (priceLine !== null) {
        return { point: { x: point.x, y: priceLine }, time: null };
      }
    }

    const ohlc = this.snapToOhlc(pane, point);
    if (!ohlc) {
      return { point, time: null };
    }
    return {
      point: {
        x: point.x,
        y: pane.priceScale.priceToY(ohlc.price, pane.plot.top, pane.plot.height),
      },
      time: ohlc.time,
    };
  }

  private nearestDrawingAnchor(pane: Pane, point: Point): { point: Point; time: number } | null {
    const plot = pane.plot;
    if (!plot) {
      return null;
    }
    let nearest: { point: Point; time: number; distance: number } | null = null;
    for (const drawing of this.drawings) {
      if (drawing.paneId !== pane.id) {
        continue;
      }
      for (const anchor of drawing.getAnchorsInternal()) {
        const x = this.timeScaleModel.timeToX(anchor.time);
        if (x === null) {
          continue;
        }
        const y = pane.priceScale.priceToY(anchor.price, plot.top, plot.height);
        const distance = Math.hypot(x - point.x, y - point.y);
        if (distance > MAGNET_DRAWING_RADIUS) {
          continue;
        }
        if (!nearest || distance < nearest.distance) {
          nearest = { point: { x, y }, time: anchor.time, distance };
        }
      }
    }
    return nearest ? { point: nearest.point, time: nearest.time } : null;
  }

  private nearestPriceLine(pane: Pane, point: Point): number | null {
    const plot = pane.plot;
    if (!plot) {
      return null;
    }
    let nearest: { y: number; distance: number } | null = null;
    for (const series of pane.series) {
      for (const line of series.toRenderData().priceLines) {
        const y = pane.priceScale.priceToY(line.price, plot.top, plot.height);
        const distance = Math.abs(y - point.y);
        if (distance > MAGNET_PRICE_LINE_RADIUS) {
          continue;
        }
        if (!nearest || distance < nearest.distance) {
          nearest = { y, distance };
        }
      }
    }
    return nearest?.y ?? null;
  }

  private snapToOhlc(pane: Pane, point: Point): { price: number; time: number } | null {
    const plot = pane.plot;
    if (!plot) {
      return null;
    }
    const series =
      pane.series.find(
        (candidate) => candidate.kind === "candlestick" && candidate.getStore().length > 0,
      ) ?? pane.series.find((candidate) => candidate.getStore().length > 0);
    if (!series) {
      return null;
    }
    const store = series.getStore();
    if (store.length === 0) {
      return null;
    }
    const index = Math.round(this.timeScaleModel.xToIndex(point.x));
    const clamped = Math.max(0, Math.min(store.length - 1, index));
    const rawPrice = pane.priceScale.yToPrice(point.y, plot.top, plot.height);
    const ohlc = series.kind === "candlestick" ? series.getOhlcStore() : null;
    const candidates = ohlc
      ? [ohlc.openAt(clamped), ohlc.highAt(clamped), ohlc.lowAt(clamped), ohlc.closeAt(clamped)]
      : [store.valueAt(clamped)];
    let price = candidates[0]!;
    for (const candidate of candidates) {
      if (Math.abs(candidate - rawPrice) < Math.abs(price - rawPrice)) {
        price = candidate;
      }
    }
    return { price, time: store.timeAt(clamped) };
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

    const snapped = this.snapPointForMagnet(pane, point);
    const snappedPoint = snapped.point;
    const store = this.primaryStore();
    let time: number | null = snapped.time;

    if (time === null && store && store.length > 0) {
      const index = Math.round(this.timeScaleModel.xToIndex(snappedPoint.x));
      if (index >= 0 && index < store.length) {
        time = store.timeAt(index);
      }
    }

    const price = pane.priceScale.yToPrice(snappedPoint.y, pane.plot.top, pane.plot.height);
    this.bus.emit("click", {
      time,
      price,
      paneId: pane.id,
      point: snappedPoint,
      button: "left",
    });
  }

  private localPoint(event: { clientX: number; clientY: number }): Point {
    const rect = this.backend.root.getBoundingClientRect();
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

  private priceAxisPaneAtPoint(point: Point): Pane | null {
    const pane = this.paneAtY(point.y);
    if (!pane || !pane.plot) {
      return null;
    }
    if (point.x < pane.plot.right || point.x > pane.plot.right + this.axisWidth) {
      return null;
    }
    return pane;
  }

  private timeAxisPaneAtPoint(point: Point): Pane | null {
    const pane = this.panes[this.panes.length - 1];
    if (!pane || !pane.plot) {
      return null;
    }
    if (
      point.y < pane.plot.bottom ||
      point.y > pane.plot.bottom + this.computeAxisHeight() ||
      point.x < pane.plot.left ||
      point.x > pane.plot.right
    ) {
      return null;
    }
    return pane;
  }

  private updateTimeAxisDrag(point: Point): void {
    const drag = this.timeAxisDrag;
    if (!drag) {
      return;
    }
    const deltaX = point.x - drag.lastX;
    if (!drag.moved && Math.abs(point.x - drag.startX) < 2) {
      return;
    }
    drag.moved = true;
    drag.lastX = point.x;
    if (deltaX === 0) {
      return;
    }
    this.timeScaleModel.zoomAt(drag.anchorX, -deltaX * 2.5);
    this.requestRender();
    this.emitVisibleRange();
    this.notifyViewChange();
  }

  private updatePriceAxisDrag(point: Point): void {
    const drag = this.priceAxisDrag;
    if (!drag || !drag.pane.plot) {
      return;
    }
    const deltaY = point.y - drag.startY;
    if (!drag.moved && Math.abs(deltaY) < 2) {
      return;
    }
    drag.moved = true;
    const factor = Math.min(20, Math.max(0.05, Math.exp(deltaY * 0.005)));
    const middle = (drag.startRange.min + drag.startRange.max) / 2;
    const halfSpan = ((drag.startRange.max - drag.startRange.min) / 2) * factor;
    drag.pane.priceScale.setVisibleRange({
      min: middle - halfSpan,
      max: middle + halfSpan,
    });
    this.requestRender();
  }

  private panPanePrice(pane: Pane, deltaY: number): void {
    if (!pane.plot) {
      return;
    }
    const range = pane.priceScale.getVisibleRange();
    const deltaPrice = (deltaY / pane.plot.height) * (range.max - range.min);
    pane.priceScale.setVisibleRange({
      min: range.min + deltaPrice,
      max: range.max + deltaPrice,
    });
  }

  private updatePointerCursor(point: Point): void {
    const linePane = this.paneAtPoint(point) ?? this.priceAxisPaneAtPoint(point);
    this.backend.root.style.cursor =
      (linePane && this.findPriceLineHandle(linePane, point)) || this.priceAxisPaneAtPoint(point)
        ? "ns-resize"
        : this.timeAxisPaneAtPoint(point)
          ? "ew-resize"
          : "crosshair";
  }

  private setupObserver(): void {
    this.teardownObserver();

    if (!this.options.autoSize || typeof ResizeObserver === "undefined") {
      return;
    }

    this.observer = new ResizeObserver(() => {
      this.resize();
      // Resizing clears the canvas backing stores. Render in this observer turn,
      // before paint, so a cleared frame is never presented while dragging.
      if (this.frame !== null) {
        cancelFrame(this.frame);
        this.frame = null;
      }
      this.render();
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
    const root = this.backend.root;
    root.addEventListener("pointerdown", this.onPointerDown);
    root.addEventListener("pointermove", this.onPointerMove);
    root.addEventListener("pointerup", this.onPointerUp);
    root.addEventListener("pointercancel", this.onPointerCancel);
    root.addEventListener("pointerleave", this.onPointerLeave);
    root.addEventListener("dblclick", this.onDoubleClick);
    root.addEventListener("keydown", this.onKeyDown);
    root.addEventListener("keyup", this.onKeyUp);
    root.addEventListener("wheel", this.onWheel, { passive: false });
  }

  private detachEvents(): void {
    const root = this.backend.root;
    root.removeEventListener("pointerdown", this.onPointerDown);
    root.removeEventListener("pointermove", this.onPointerMove);
    root.removeEventListener("pointerup", this.onPointerUp);
    root.removeEventListener("pointercancel", this.onPointerCancel);
    root.removeEventListener("pointerleave", this.onPointerLeave);
    root.removeEventListener("dblclick", this.onDoubleClick);
    root.removeEventListener("keydown", this.onKeyDown);
    root.removeEventListener("keyup", this.onKeyUp);
    root.removeEventListener("wheel", this.onWheel);
  }
}

const LINE_ANGLE_TOOLS = new Set([
  "trend-line",
  "ray",
  "extended-line",
  "arrow",
  "trend-angle",
  "gann-fan",
  "measure",
  "stats-line",
]);

const CHANNEL_ANGLE_TOOLS = new Set([
  "parallel-channel",
  "fib-channel",
  "flat-top-bottom",
  "speed-lines",
  "pitchfork",
  "schiff-pitchfork",
  "modified-schiff-pitchfork",
]);

export function placementAngleReference(toolId: string, anchorIndex: number): number | null {
  if (LINE_ANGLE_TOOLS.has(toolId)) {
    return anchorIndex === 1 ? 0 : null;
  }
  if (CHANNEL_ANGLE_TOOLS.has(toolId)) {
    return anchorIndex === 1 ? 0 : null;
  }
  if (toolId === "disjoint-channel") {
    if (anchorIndex === 1) {
      return 0;
    }
    if (anchorIndex === 3) {
      return 2;
    }
  }
  return null;
}

export function dragAngleReference(toolId: string, anchorIndex: number): number | null {
  if (LINE_ANGLE_TOOLS.has(toolId)) {
    if (anchorIndex === 0) {
      return 1;
    }
    if (anchorIndex === 1) {
      return 0;
    }
    return null;
  }
  if (CHANNEL_ANGLE_TOOLS.has(toolId)) {
    if (anchorIndex === 0) {
      return 1;
    }
    if (anchorIndex === 1) {
      return 0;
    }
    return null;
  }
  if (toolId === "disjoint-channel") {
    if (anchorIndex === 0) {
      return 1;
    }
    if (anchorIndex === 1) {
      return 0;
    }
    if (anchorIndex === 2) {
      return 3;
    }
    if (anchorIndex === 3) {
      return 2;
    }
  }
  return null;
}

export function constrainPointAngle(reference: Point, point: Point): Point {
  const dx = point.x - reference.x;
  const dy = point.y - reference.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) {
    return point;
  }
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return {
    x: reference.x + Math.cos(angle) * length,
    y: reference.y + Math.sin(angle) * length,
  };
}

function inferStoreInterval(store: {
  length: number;
  timeAt(index: number): number;
}): number | null {
  const start = Math.max(0, store.length - 21);
  const steps: number[] = [];
  for (let index = start + 1; index < store.length; index += 1) {
    const step = store.timeAt(index) - store.timeAt(index - 1);
    if (Number.isFinite(step) && step > 0) {
      steps.push(step);
    }
  }
  if (steps.length === 0) {
    return null;
  }
  steps.sort((first, second) => first - second);
  return steps[Math.floor(steps.length / 2)]!;
}

function inferIntervalLabel(step: number): string {
  if (step >= 28 * 86_400_000) {
    return "1M";
  }
  if (step >= 7 * 86_400_000) {
    return "1w";
  }
  if (step >= 86_400_000) {
    return `${Math.round(step / 86_400_000)}d`;
  }
  if (step >= 3_600_000) {
    return `${Math.round(step / 3_600_000)}h`;
  }
  if (step >= 60_000) {
    return `${Math.round(step / 60_000)}m`;
  }
  return `${Math.max(1, Math.round(step / 1000))}s`;
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

function createRendererBackend(
  container: HTMLElement,
  timeScale: TimeScale,
  kind: "canvas2d" | "webgl2",
): RendererBackend {
  if (kind === "webgl2") {
    try {
      return new WebGL2Renderer(container, timeScale);
    } catch {
      // Fall back to the reference backend when WebGL2 is unavailable.
    }
  }
  return new Canvas2DRenderer(container, timeScale);
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
  const axisFontSize = options.layout?.axisFontSize ?? fontSize;
  if (!Number.isFinite(axisFontSize) || axisFontSize <= 0) {
    fail("INVALID_ARGUMENT", "layout.axisFontSize must be a positive number");
  }
  const textColor = options.layout?.textColor ?? "#131722";

  return {
    autoSize,
    width,
    height,
    locale,
    timezone,
    ...(options.interval !== undefined ? { interval: options.interval } : {}),
    layout: {
      background: options.layout?.background ?? "#ffffff",
      textColor,
      fontSize,
      axisTextColor: options.layout?.axisTextColor ?? textColor,
      axisFontSize,
      ...(options.layout?.axisLineColor !== undefined
        ? { axisLineColor: options.layout.axisLineColor }
        : {}),
    },
    grid: resolveGrid(options.grid),
    crosshair: resolveCrosshair(options.crosshair),
    interaction: {
      wheel: options.interaction?.wheel ?? true,
      drag: options.interaction?.drag ?? true,
      pinch: options.interaction?.pinch ?? true,
      axisDrag: options.interaction?.axisDrag ?? true,
      axisDoubleClickReset: options.interaction?.axisDoubleClickReset ?? true,
    },
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

  merged.interaction = mergeDefined<InteractionOptions>(base.interaction ?? {}, patch.interaction);
  merged.timeScale = mergeDefined<TimeScaleOptions>(base.timeScale ?? {}, patch.timeScale);
  merged.priceScale = mergeDefined<PriceScaleOptions>(base.priceScale ?? {}, patch.priceScale);
  merged.priceScale.priceFormat = mergeDefined(
    base.priceScale?.priceFormat ?? {},
    patch.priceScale?.priceFormat,
  );
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
    magnet: options?.magnet === "strong" ? "strong" : "weak",
    modifierMagnet:
      options?.modifierMagnet === "strong"
        ? "strong"
        : options?.modifierMagnet === "off"
          ? "off"
          : "weak",
    color,
    vertColor: options?.vertLine?.color ?? color,
    horzColor: options?.horzLine?.color ?? color,
    ...(options?.labelBackground !== undefined ? { labelBackground: options.labelBackground } : {}),
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
