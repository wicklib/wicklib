import type { OhlcStore } from "./data/ohlc-store";
import { fail, WickError } from "./errors";
import { Drawing, type DrawingHost } from "./drawing";
import {
  DRAWING_TOOLS,
  hitTestAnchor,
  hitTestDrawing,
  resolveDrawingOptions,
  type DrawingGeometryPane,
} from "./drawings";
import { EventBus } from "./events";
import { Indicator } from "./indicator";
import { Pane, type PaneHost } from "./pane";
import { CanvasStack } from "./render/canvas-stack";
import {
  ChartRenderer,
  TIME_AXIS_HEIGHT,
  type ChartRenderModel,
  type CrosshairRenderPoint,
  type OverlayRenderData,
  type PaneRenderModel,
  type ResolvedCrosshair,
  type DrawingRenderData,
  type ResolvedGrid,
  type ResolvedLayout,
} from "./render/chart-renderer";
import { TimeScale, type TimeScaleSource } from "./scale/time-scale";
import { CandlestickSeries, Series, type SeriesHost } from "./series";
import type {
  AddDrawingOptions,
  AddIndicatorOptions,
  CandlestickSeriesOptions,
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
  PriceScaleApi,
  PriceScaleOptions,
  SeriesApi,
  SeriesData,
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
const MIN_AXIS_WIDTH = 40;
const MAX_AXIS_WIDTH = 160;

interface ResolvedOptions {
  autoSize: boolean;
  width: number;
  height: number;
  locale: string;
  timezone: string;
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
  private readonly stack: CanvasStack;
  private readonly timeScaleModel: TimeScale;
  private readonly renderer: ChartRenderer;
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
  private readonly overlays: OverlayEntry[] = [];
  private selectedDrawingId: string | null = null;
  private activeTool: DrawingToolDefinition | null = null;
  private activeDrawingOptions: DrawingOptions | undefined;
  private activeDrawingPaneId = "main";
  private pendingAnchors: DrawingAnchor[] = [];
  private previewPoint: Point | null = null;
  private draggingDrawing: Drawing | null = null;
  private draggingAnchorIndex = -1;
  private drawingDragStart: Point | null = null;
  private drawingDragAnchors: DrawingAnchor[] | null = null;
  private drawingDragMoved = false;
  private drawingDragPointerId: number | null = null;
  private crosshairPoint: CrosshairRenderPoint | null = null;
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

    this.drawingHost = {
      assertAlive: () => this.assertAlive(),
      requestRender: () => this.requestRender(),
      emitUpdated: (drawing) => this.emitDrawingUpdated(drawing),
      removeDrawing: (drawing) => this.removeDrawing(drawing),
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

  addDrawing(tool: DrawingToolDefinition, options: AddDrawingOptions): DrawingApi {
    this.assertAlive();
    const pane = this.resolveDrawingPane(options.paneId);
    const drawing = this.createDrawing(tool, pane, options.anchors, options.options);
    this.setSelected(drawing);
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
    if (this.activeTool) {
      this.cancelDrawing();
    }
    const pane = this.resolveDrawingPane(options?.paneId);
    this.activeTool = tool;
    this.activeDrawingOptions = options?.options;
    this.activeDrawingPaneId = pane.id;
    this.pendingAnchors = [];
    this.previewPoint = null;
    this.setSelected(null);
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

  private selectedInternal(): Drawing | null {
    return this.selectedDrawingId ? this.findDrawing(this.selectedDrawingId) : null;
  }

  private drawingPane(pane: Pane): DrawingGeometryPane | null {
    if (!pane.plot) {
      return null;
    }
    return { plot: pane.plot, priceScale: pane.priceScale };
  }

  selectDrawing(id: string | null): void {
    this.assertAlive();
    if (id === null) {
      this.setSelected(null);
      return;
    }
    const drawing = this.findDrawing(id);
    if (!drawing) {
      fail("INVALID_ARGUMENT", `Unknown drawing: ${id}`);
    }
    this.setSelected(drawing);
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
    this.overlays.length = 0;
    this.selectedDrawingId = null;
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

    this.bus.emit("drawing-selected", { drawing: null });
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
    const drawing = new Drawing(
      this.nextDrawingId(),
      pane.id,
      tool,
      anchors,
      options,
      this.drawingHost,
    );
    this.drawings.push(drawing);
    return drawing;
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

  private setSelected(drawing: Drawing | null): void {
    const id = drawing?.id ?? null;
    if (this.selectedDrawingId === id) {
      return;
    }
    this.selectedDrawingId = id;
    this.bus.emit("drawing-selected", { drawing });
    this.requestRender();
  }

  private removeDrawing(drawing: Drawing): void {
    const index = this.drawings.indexOf(drawing);
    if (index < 0) {
      return;
    }
    drawing.destroyInternal();
    this.drawings.splice(index, 1);
    this.resetDrawingDrag();
    if (this.selectedDrawingId === drawing.id) {
      this.selectedDrawingId = null;
      this.bus.emit("drawing-selected", { drawing: null });
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
      drawing.destroyInternal();
      this.drawings.splice(index, 1);
      if (this.selectedDrawingId === drawing.id) {
        this.selectedDrawingId = null;
        this.bus.emit("drawing-selected", { drawing: null });
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

  private resetDrawingTool(): void {
    this.activeTool = null;
    this.activeDrawingOptions = undefined;
    this.activeDrawingPaneId = "main";
    this.pendingAnchors = [];
    this.previewPoint = null;
  }

  private buildDrawingRenderData(): DrawingRenderData[] {
    const result: DrawingRenderData[] = this.drawings.map((drawing) => ({
      id: drawing.id,
      toolId: drawing.toolId,
      paneId: drawing.paneId,
      anchors: drawing.getAnchorsInternal(),
      previewPoint: null,
      options: drawing.getOptions(),
      selected: drawing.id === this.selectedDrawingId,
      preview: false,
    }));

    if (this.activeTool && this.pendingAnchors.length > 0) {
      result.push({
        id: "__preview__",
        toolId: this.activeTool.id,
        paneId: this.activeDrawingPaneId,
        anchors: this.pendingAnchors,
        previewPoint:
          this.activeTool.anchors > 1 && this.pendingAnchors.length < this.activeTool.anchors
            ? this.previewPoint
            : null,
        options: resolveDrawingOptions(this.activeTool.defaultOptions, this.activeDrawingOptions),
        selected: false,
        preview: true,
      });
    }

    return result;
  }

  private drawingAnchor(pane: Pane, point: Point): DrawingAnchor | null {
    if (!pane.plot) {
      return null;
    }

    const time = this.timeScaleModel.timeAtX(point.x);
    if (time === null) {
      return null;
    }

    const price = pane.priceScale.yToPrice(point.y, pane.plot.top, pane.plot.height);
    return { time, price };
  }

  private placeAnchor(pane: Pane, point: Point): void {
    if (!this.activeTool) {
      return;
    }

    if (this.pendingAnchors.length > 0 && pane.id !== this.activeDrawingPaneId) {
      return;
    }

    const anchor = this.drawingAnchor(pane, point);
    if (!anchor) {
      return;
    }

    if (this.pendingAnchors.length === 0) {
      this.activeDrawingPaneId = pane.id;
    }

    this.pendingAnchors.push(anchor);
    this.previewPoint = point;

    if (this.pendingAnchors.length >= this.activeTool.anchors) {
      const tool = this.activeTool;
      const options = this.activeDrawingOptions;
      const targetPane = this.findPane(this.activeDrawingPaneId) ?? pane;
      const drawing = this.createDrawing(tool, targetPane, this.pendingAnchors, options);
      this.resetDrawingTool();
      this.setSelected(drawing);
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
    const selected = this.selectedInternal();

    if (selected && selected.paneId === pane.id) {
      const selectedTarget = this.hitTarget(selected);
      const handle = hitTestAnchor(selectedTarget, point, geometry, this.timeScaleModel);
      if (handle >= 0) {
        if (!selected.isLocked()) {
          this.beginDrawingDrag(selected, handle, point, event);
        }
        return true;
      }
    }

    for (let index = this.drawings.length - 1; index >= 0; index -= 1) {
      const drawing = this.drawings[index]!;
      if (drawing.paneId !== pane.id) {
        continue;
      }
      if (!hitTestDrawing(this.hitTarget(drawing), point, geometry, this.timeScaleModel)) {
        continue;
      }

      this.setSelected(drawing);
      if (!drawing.isLocked()) {
        this.beginDrawingDrag(drawing, -1, point, event);
      }
      return true;
    }

    this.setSelected(null);
    return false;
  }

  private beginDrawingDrag(
    drawing: Drawing,
    anchorIndex: number,
    point: Point,
    event: PointerEvent,
  ): void {
    this.draggingDrawing = drawing;
    this.draggingAnchorIndex = anchorIndex;
    this.drawingDragStart = point;
    this.drawingDragAnchors = drawing.getAnchors().map((anchor) => ({ ...anchor }));
    this.drawingDragMoved = false;
    this.drawingDragPointerId = event.pointerId;

    try {
      this.stack.root.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort.
    }

    this.clearCrosshair();
    this.requestRender();
  }

  private updateDrawingDrag(point: Point): void {
    const drawing = this.draggingDrawing;
    const anchors = this.drawingDragAnchors;
    const start = this.drawingDragStart;
    if (!drawing || !anchors || !start) {
      return;
    }

    const pane = this.findPane(drawing.paneId);
    if (!pane || !pane.plot) {
      return;
    }

    const next = anchors.map((anchor) => ({ ...anchor }));

    if (this.draggingAnchorIndex >= 0) {
      const anchor = this.drawingAnchor(pane, point);
      if (!anchor) {
        return;
      }
      next[this.draggingAnchorIndex] = anchor;
    } else {
      const startTime = this.timeScaleModel.timeAtX(start.x);
      const currentTime = this.timeScaleModel.timeAtX(point.x);
      const timeDelta = (currentTime ?? startTime ?? 0) - (startTime ?? 0);
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

  private resetDrawingDrag(): void {
    this.draggingDrawing = null;
    this.draggingAnchorIndex = -1;
    this.drawingDragStart = null;
    this.drawingDragAnchors = null;
    this.drawingDragMoved = false;
    this.drawingDragPointerId = null;
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

  takeScreenshot(): HTMLCanvasElement {
    this.assertAlive();
    if (this.frame !== null) {
      cancelFrame(this.frame);
      this.frame = null;
      this.render();
    }
    return this.stack.compose();
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

    const plotWidth = Math.max(1, width - this.axisWidth);
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

    for (const drawing of this.drawings) {
      drawing.destroyInternal();
    }
    this.drawings.length = 0;
    this.overlays.length = 0;
    this.resetDrawingDrag();
    this.activePointers.clear();
    this.pinchDistance = null;
    this.timeAxisDrag = null;
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

  private emitIndicatorError(indicatorId: string, error: WickError): void {
    this.bus.emit("error", { error, source: "indicator", indicatorId });
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }

    const point = this.localPoint(event);
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
      this.stack.root.style.cursor = "ns-resize";
      try {
        this.stack.root.setPointerCapture(event.pointerId);
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
      this.stack.root.style.cursor = "ew-resize";
      try {
        this.stack.root.setPointerCapture(event.pointerId);
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
      this.placeAnchor(pane, point);
      return;
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
      this.pinchDistance = this.options.interaction.pinch ? this.currentPinchDistance() : null;
      this.resetDrawingDrag();
      this.clearCrosshair();
      return;
    }

    if (this.tryStartDrawingDrag(pane, point, event)) {
      this.dragging = false;
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

    if (this.timeAxisDrag && event.pointerId === this.timeAxisDrag.pointerId) {
      this.updateTimeAxisDrag(point);
      return;
    }

    if (this.priceAxisDrag && event.pointerId === this.priceAxisDrag.pointerId) {
      this.updatePriceAxisDrag(point);
      return;
    }

    if (this.activeTool) {
      this.previewPoint = point;
      this.updateCrosshair(point.x, point.y);
      this.requestRender();
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

    if (this.draggingDrawing && event.pointerId === this.drawingDragPointerId) {
      this.updateDrawingDrag(point);
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

    this.updatePointerCursor(point);
    this.updateCrosshair(point.x, point.y);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);

    if (this.timeAxisDrag && event.pointerId === this.timeAxisDrag.pointerId) {
      const point = this.localPoint(event);
      try {
        this.stack.root.releasePointerCapture(event.pointerId);
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
        this.stack.root.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort.
      }
      this.priceAxisDrag = null;
      this.updatePointerCursor(point);
      return;
    }

    if (this.activeTool) {
      return;
    }

    if (this.draggingDrawing && event.pointerId === this.drawingDragPointerId) {
      const point = this.localPoint(event);
      try {
        this.stack.root.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort.
      }
      this.resetDrawingDrag();
      this.updateCrosshair(point.x, point.y);
      return;
    }

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
    this.dragPane = null;

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
    this.dragPane = null;
    this.priceAxisDrag = null;
    this.timeAxisDrag = null;
    this.resetDrawingDrag();
    this.stack.root.style.cursor = "crosshair";
    this.clearCrosshair();
  };

  private readonly onPointerLeave = (): void => {
    if (this.activeTool) {
      this.previewPoint = null;
      this.requestRender();
      return;
    }
    if (!this.priceAxisDrag) {
      this.stack.root.style.cursor = "crosshair";
    }
    if (
      !this.dragging &&
      this.pinchDistance === null &&
      !this.draggingDrawing &&
      !this.priceAxisDrag &&
      !this.timeAxisDrag
    ) {
      this.clearCrosshair();
    }
  };

  private readonly onDoubleClick = (event: MouseEvent): void => {
    if (!this.options.interaction.axisDoubleClickReset) {
      return;
    }
    const point = this.localPoint(event);
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
    if (event.key === "Delete" || event.key === "Backspace") {
      const selected = this.selectedInternal();
      if (selected) {
        if (!selected.isLocked()) {
          selected.remove();
        }
        event.preventDefault();
        return;
      }
    }

    if (event.key === "Escape") {
      if (this.activeTool) {
        this.cancelDrawing();
      } else if (this.selectedInternal()) {
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
    if (!this.options.interaction.wheel) {
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

    for (const pane of this.panes) {
      if (!pane.priceScale.isAutoScale()) {
        continue;
      }
      const range = this.visiblePanePriceRange(pane);
      if (range) {
        pane.priceScale.setAutoRange(range.min, range.max);
      }
    }

    const axisWidth = this.computeAxisWidth();
    if (axisWidth !== this.axisWidth) {
      this.axisWidth = axisWidth;
      this.relayout();
      model = this.buildModel();
      if (!model) {
        return;
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
      locale: this.options.locale,
      timezone: this.options.timezone,
      timeVisible: timeOptions.timeVisible,
      secondsVisible: timeOptions.secondsVisible,
      axisWidth: this.axisWidth,
      axisHeight: TIME_AXIS_HEIGHT,
    };
  }

  private computeAxisWidth(): number {
    const context = this.stack.context("grid");
    context.font = `${this.options.layout.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    let widest = 0;

    for (const pane of this.panes) {
      if (!pane.plot || pane.plot.height <= 0) {
        continue;
      }

      for (const tick of pane.priceScale.ticks(pane.plot.height)) {
        widest = Math.max(
          widest,
          context.measureText(pane.priceScale.formatValue(tick.value, this.options.locale)).width,
        );
      }

      for (const series of pane.series) {
        if (!series.isVisible()) {
          continue;
        }
        const data = series.toRenderData();
        const last = data.bars.lastBar();
        if (last && data.lastValueVisible) {
          widest = Math.max(
            widest,
            context.measureText(pane.priceScale.formatValue(last.close, this.options.locale)).width,
          );
        }
        for (const line of data.priceLines) {
          if (!line.axisLabelVisible) {
            continue;
          }
          const value = pane.priceScale.formatValue(line.price, this.options.locale);
          const label =
            line.title && line.titlePosition === "axis" ? `${line.title} ${value}` : value;
          widest = Math.max(widest, context.measureText(label).width);
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
      point.y > pane.plot.bottom + TIME_AXIS_HEIGHT ||
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
    this.stack.root.style.cursor = this.priceAxisPaneAtPoint(point)
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
    root.addEventListener("dblclick", this.onDoubleClick);
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
    root.removeEventListener("dblclick", this.onDoubleClick);
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
