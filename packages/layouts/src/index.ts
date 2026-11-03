/**
 * Free multi-chart layout primitives for Wicklib.
 */

import {
  WickError,
  createChart,
  type ChartApi,
  type ChartOptions,
  type ChartOverlayApi,
  type CrosshairEvent,
  type OverlayRenderFrame,
  type Unsubscribe,
  type VisibleRangeEvent,
} from "@wicklib/core";

/**
 * Crosshair synchronization mode.
 *
 * `time` mirrors the vertical time line. `full` also mirrors a horizontal line at the same
 * relative pane height.
 */
export type ChartLayoutCrosshairMode = "off" | "time" | "full";

/**
 * Resolved synchronization behavior for a layout.
 */
export interface ChartLayoutSyncOptions {
  /** Synchronize visible time ranges. */
  timeRange: boolean;
  /** Crosshair synchronization mode. */
  crosshair: ChartLayoutCrosshairMode;
}

/**
 * Partial synchronization update. Boolean crosshair values map to `time` and `off`.
 */
export interface ChartLayoutSyncUpdate {
  /** Synchronize visible time ranges. */
  timeRange?: boolean;
  /** Crosshair synchronization mode. */
  crosshair?: boolean | ChartLayoutCrosshairMode;
}

/**
 * Options for a layout chart cell.
 */
export interface ChartLayoutSlotOptions {
  /** Stable slot id. Generated when omitted. */
  id?: string;
  /** Chart options for this slot. Merged over the layout defaults. */
  chartOptions?: ChartOptions;
  /** Number of grid rows covered by the cell. Defaults to 1. */
  rowSpan?: number;
  /** Number of grid columns covered by the cell. Defaults to 1. */
  columnSpan?: number;
  /** Synchronization group. Slots only sync with slots in the same group. */
  syncGroup?: string;
}

/**
 * One chart cell in a layout.
 */
export interface ChartLayoutSlot {
  readonly id: string;
  readonly chart: ChartApi;
  readonly element: HTMLElement;
  readonly rowSpan: number;
  readonly columnSpan: number;
  readonly syncGroup: string;
}

/**
 * Serializable structural layout state. Chart state is owned by the host.
 */
export interface ChartLayoutSnapshot {
  version: 1;
  columns: number;
  gap: number;
  sync: ChartLayoutSyncOptions;
  slots: ReadonlyArray<{
    id: string;
    rowSpan: number;
    columnSpan: number;
    syncGroup: string;
  }>;
}

/**
 * Options for a multi-chart layout.
 */
export interface ChartLayoutOptions {
  /** Number of grid columns. Defaults to 2. */
  columns?: number;
  /** Gap between cells in CSS pixels. Defaults to 1. */
  gap?: number;
  /** Default chart options applied to every slot. */
  chartOptions?: ChartOptions;
  /** Synchronization options. */
  sync?: ChartLayoutSyncUpdate;
  /** Synchronize visible time ranges. Defaults to true. */
  syncTimeRange?: boolean;
  /** Crosshair synchronization. Defaults to `time`. */
  syncCrosshair?: boolean | ChartLayoutCrosshairMode;
  /** Crosshair line colour. */
  crosshairColor?: string;
  /** Extra class name on the layout root. */
  className?: string;
  /** Called when the active chart changes. */
  onActiveChange?: (chartId: string | null) => void;
}

/**
 * A live multi-chart layout.
 */
export interface ChartLayoutApi {
  /** Layout root inserted into the host container. */
  readonly element: HTMLElement;
  /** Adds a chart cell and returns its live slot. */
  addChart(options?: ChartLayoutSlotOptions): ChartLayoutSlot;
  /** Destroys and removes one chart cell. */
  removeChart(id: string): void;
  /** Returns a live chart, or null when the id is unknown. */
  getChart(id: string): ChartApi | null;
  /** Returns the current slots in DOM order. */
  getSlots(): readonly ChartLayoutSlot[];
  /** Returns slot ids in DOM order. */
  chartIds(): readonly string[];
  /** Changes the grid column count. */
  setColumns(columns: number): void;
  /** Changes the cell gap in CSS pixels. */
  setGap(gap: number): void;
  /** Changes synchronization behavior without recreating charts. */
  setSyncOptions(options: ChartLayoutSyncUpdate): void;
  /** Returns the resolved synchronization behavior. */
  getSyncOptions(): Readonly<ChartLayoutSyncOptions>;
  /** Marks one chart as active. Pass null to clear. */
  setActiveChart(id: string | null): void;
  /** Returns the active chart id, or null. */
  activeChartId(): string | null;
  /** Subscribes to active chart changes. */
  onActiveChange(handler: (chartId: string | null) => void): Unsubscribe;
  /** Applies the active chart's visible range to every chart in its sync group. */
  syncNow(): void;
  /** Returns structural layout state for host persistence. */
  serialize(): ChartLayoutSnapshot;
  /** Destroys every chart and removes the layout root. */
  destroy(): void;
}

interface InternalSlot {
  readonly slot: ChartLayoutSlot;
  readonly unsubscribe: readonly Unsubscribe[];
  overlay: ChartOverlayApi | null;
  readonly onPointerDown: () => void;
  readonly onFocusIn: () => void;
}

interface CrosshairState {
  sourceId: string;
  sourceGroup: string;
  time: number;
  yRatio: number | null;
}

const DEFAULT_COLUMNS = 2;
const DEFAULT_GAP = 1;
const DEFAULT_SYNC_GROUP = "default";
const MAX_COLUMNS = 12;
const DEFAULT_CROSSHAIR_COLOR = "rgba(139, 149, 167, 0.6)";

/**
 * Creates a framework-agnostic grid of Wicklib charts.
 *
 * The layout owns chart creation, grid placement, time-range synchronization, and a
 * mirrored crosshair. It does not own data, symbol state, accounts, or persistence.
 */
export function createChartLayout(
  container: HTMLElement,
  options: ChartLayoutOptions = {},
): ChartLayoutApi {
  return new ChartLayout(container, options);
}

class ChartLayout implements ChartLayoutApi {
  readonly element: HTMLElement;

  private readonly slots: InternalSlot[] = [];
  private readonly activeHandlers = new Set<(chartId: string | null) => void>();
  private readonly crosshairOverlays = new Map<string, ChartOverlayApi>();
  private readonly chartOptions: ChartOptions | undefined;
  private readonly crosshairColor: string;
  private columns: number;
  private gap: number;
  private sync: ChartLayoutSyncOptions;
  private activeId: string | null = null;
  private counter = 0;
  private applyingRange = false;
  private crosshair: CrosshairState | null = null;
  private destroyed = false;

  constructor(container: HTMLElement, options: ChartLayoutOptions) {
    if (!container || typeof container.appendChild !== "function") {
      throw new WickError("INVALID_ARGUMENT", "createChartLayout requires a DOM container");
    }

    this.columns = validateColumns(options.columns ?? DEFAULT_COLUMNS);
    this.gap = validateGap(options.gap ?? DEFAULT_GAP);
    this.chartOptions = options.chartOptions;
    this.sync = resolveSyncOptions(options);
    this.crosshairColor = options.crosshairColor ?? DEFAULT_CROSSHAIR_COLOR;
    if (options.onActiveChange) {
      this.activeHandlers.add(options.onActiveChange);
    }

    this.element = document.createElement("div");
    this.element.className = ["wicklib-chart-layout", options.className].filter(Boolean).join(" ");
    Object.assign(this.element.style, {
      display: "grid",
      width: "100%",
      height: "100%",
      minWidth: "0",
      minHeight: "0",
      gridAutoRows: "minmax(0, 1fr)",
      gap: `${this.gap}px`,
    });
    this.applyGrid();
    container.appendChild(this.element);
  }

  addChart(options: ChartLayoutSlotOptions = {}): ChartLayoutSlot {
    this.assertAlive();
    const id = options.id ?? `chart-${++this.counter}`;
    if (this.findSlot(id)) {
      throw new WickError("INVALID_ARGUMENT", `Duplicate chart layout id: ${id}`);
    }
    const rowSpan = validateSpan(options.rowSpan ?? 1, "rowSpan");
    const columnSpan = validateSpan(options.columnSpan ?? 1, "columnSpan");
    const syncGroup = validateSyncGroup(options.syncGroup ?? DEFAULT_SYNC_GROUP);

    const element = document.createElement("div");
    element.className = "wicklib-chart-layout__cell";
    element.dataset.chartId = id;
    Object.assign(element.style, {
      position: "relative",
      minWidth: "0",
      minHeight: "0",
      overflow: "hidden",
      gridRow: `span ${rowSpan}`,
      gridColumn: `span ${columnSpan}`,
    });
    this.element.appendChild(element);

    let chart: ChartApi;
    try {
      chart = createChart(element, mergeChartOptions(this.chartOptions, options.chartOptions));
    } catch (error) {
      element.remove();
      throw error;
    }

    const onPointerDown = (): void => this.setActiveChart(id);
    const onFocusIn = (): void => this.setActiveChart(id);
    element.addEventListener("pointerdown", onPointerDown, true);
    element.addEventListener("focusin", onFocusIn);

    const unsubscribes: Unsubscribe[] = [
      chart.on("visible-range", (event) => this.handleVisibleRange(id, event)),
      chart.on("crosshair", (event) => this.handleCrosshair(id, event)),
    ];

    const slot: ChartLayoutSlot = {
      id,
      chart,
      element,
      rowSpan,
      columnSpan,
      syncGroup,
    };
    const entry: InternalSlot = {
      slot,
      unsubscribe: unsubscribes,
      overlay: null,
      onPointerDown,
      onFocusIn,
    };
    this.slots.push(entry);
    this.ensureCrosshairOverlay(entry);

    if (this.activeId === null) {
      this.setActiveChart(id);
    }

    return slot;
  }

  removeChart(id: string): void {
    this.assertAlive();
    const index = this.slots.findIndex((entry) => entry.slot.id === id);
    if (index < 0) {
      return;
    }
    const entry = this.slots[index]!;
    this.disposeSlot(entry);
    this.slots.splice(index, 1);
    if (this.activeId === id) {
      this.setActiveChart(null);
    }
    if (this.crosshair?.sourceId === id) {
      this.crosshair = null;
      this.requestCrosshairRender();
    }
  }

  getChart(id: string): ChartApi | null {
    this.assertAlive();
    return this.findSlot(id)?.slot.chart ?? null;
  }

  getSlots(): readonly ChartLayoutSlot[] {
    this.assertAlive();
    return this.slots.map((entry) => entry.slot);
  }

  chartIds(): readonly string[] {
    this.assertAlive();
    return this.slots.map((entry) => entry.slot.id);
  }

  setColumns(columns: number): void {
    this.assertAlive();
    this.columns = validateColumns(columns);
    this.applyGrid();
  }

  setGap(gap: number): void {
    this.assertAlive();
    this.gap = validateGap(gap);
    this.element.style.gap = `${this.gap}px`;
  }

  setSyncOptions(options: ChartLayoutSyncUpdate): void {
    this.assertAlive();
    const next: ChartLayoutSyncOptions = {
      timeRange: options.timeRange ?? this.sync.timeRange,
      crosshair:
        options.crosshair === undefined
          ? this.sync.crosshair
          : normalizeCrosshair(options.crosshair),
    };
    if (next.timeRange === this.sync.timeRange && next.crosshair === this.sync.crosshair) {
      return;
    }
    this.sync = next;
    for (const entry of this.slots) {
      this.ensureCrosshairOverlay(entry);
    }
    if (next.crosshair === "off" && this.crosshair !== null) {
      this.crosshair = null;
    }
    this.requestCrosshairRender();
  }

  getSyncOptions(): Readonly<ChartLayoutSyncOptions> {
    this.assertAlive();
    return { ...this.sync };
  }

  setActiveChart(id: string | null): void {
    this.assertAlive();
    if (id !== null && !this.findSlot(id)) {
      throw new WickError("INVALID_ARGUMENT", `Unknown chart layout id: ${id}`);
    }
    if (this.activeId === id) {
      return;
    }
    const previous = this.activeId;
    this.activeId = id;
    for (const entry of this.slots) {
      if (entry.slot.id === previous) {
        delete entry.slot.element.dataset.active;
      }
      if (entry.slot.id === id) {
        entry.slot.element.dataset.active = "true";
      }
    }
    for (const handler of this.activeHandlers) {
      handler(id);
    }
  }

  activeChartId(): string | null {
    this.assertAlive();
    return this.activeId;
  }

  onActiveChange(handler: (chartId: string | null) => void): Unsubscribe {
    this.assertAlive();
    this.activeHandlers.add(handler);
    return () => {
      this.activeHandlers.delete(handler);
    };
  }

  syncNow(): void {
    this.assertAlive();
    const source = this.findSlot(this.activeId ?? this.slots[0]?.slot.id ?? "");
    if (!source) {
      return;
    }
    this.applyRange(
      source.slot.id,
      source.slot.syncGroup,
      source.slot.chart.timeScale().getVisibleRange(),
    );
  }

  serialize(): ChartLayoutSnapshot {
    this.assertAlive();
    return {
      version: 1,
      columns: this.columns,
      gap: this.gap,
      sync: { ...this.sync },
      slots: this.slots.map((entry) => ({
        id: entry.slot.id,
        rowSpan: entry.slot.rowSpan,
        columnSpan: entry.slot.columnSpan,
        syncGroup: entry.slot.syncGroup,
      })),
    };
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    for (const entry of this.slots) {
      this.disposeSlot(entry);
    }
    this.slots.length = 0;
    this.activeHandlers.clear();
    this.crosshairOverlays.clear();
    this.element.remove();
  }

  private applyGrid(): void {
    this.element.style.gridTemplateColumns = `repeat(${this.columns}, minmax(0, 1fr))`;
  }

  private findSlot(id: string | null): InternalSlot | undefined {
    if (id === null) {
      return undefined;
    }
    return this.slots.find((entry) => entry.slot.id === id);
  }

  private handleVisibleRange(sourceId: string, event: VisibleRangeEvent): void {
    if (!this.sync.timeRange || this.applyingRange) {
      return;
    }
    const source = this.findSlot(sourceId);
    if (!source) {
      return;
    }
    this.applyRange(sourceId, source.slot.syncGroup, { from: event.from, to: event.to });
  }

  private applyRange(
    sourceId: string,
    syncGroup: string,
    range: { from: number; to: number },
  ): void {
    if (!Number.isFinite(range.from) || !Number.isFinite(range.to) || range.to <= range.from) {
      return;
    }
    this.applyingRange = true;
    try {
      for (const entry of this.slots) {
        if (entry.slot.id === sourceId || entry.slot.syncGroup !== syncGroup) {
          continue;
        }
        try {
          entry.slot.chart.timeScale().setVisibleRange(range);
        } catch {
          // A chart with incompatible data can reject the range; leave it unchanged.
        }
      }
    } finally {
      this.applyingRange = false;
    }
  }

  private handleCrosshair(sourceId: string, event: CrosshairEvent): void {
    if (this.sync.crosshair === "off") {
      return;
    }
    if (event.time === null || event.point === null) {
      if (this.crosshair !== null) {
        this.crosshair = null;
        this.requestCrosshairRender();
      }
      return;
    }
    const source = this.findSlot(sourceId);
    if (!source) {
      return;
    }
    const height = source.slot.element.clientHeight;
    const yRatio = height > 0 ? Math.min(1, Math.max(0, event.point.y / height)) : null;
    this.crosshair = {
      sourceId,
      sourceGroup: source.slot.syncGroup,
      time: event.time,
      yRatio,
    };
    this.requestCrosshairRender();
  }

  private requestCrosshairRender(): void {
    for (const overlay of this.crosshairOverlays.values()) {
      overlay.requestRender();
    }
  }

  private ensureCrosshairOverlay(entry: InternalSlot): void {
    if (this.sync.crosshair === "off") {
      if (entry.overlay) {
        entry.overlay.remove();
        entry.overlay = null;
        this.crosshairOverlays.delete(entry.slot.id);
      }
      return;
    }
    if (entry.overlay) {
      return;
    }
    const id = entry.slot.id;
    const group = entry.slot.syncGroup;
    entry.overlay = entry.slot.chart.addOverlay({
      id: "wicklib-layout-crosshair",
      draw: (context, frame) => this.drawCrosshair(context, frame, id, group),
    });
    this.crosshairOverlays.set(id, entry.overlay);
  }

  private drawCrosshair(
    context: CanvasRenderingContext2D,
    frame: OverlayRenderFrame,
    id: string,
    group: string,
  ): void {
    const current = this.crosshair;
    if (
      !current ||
      current.sourceId === id ||
      current.sourceGroup !== group ||
      this.sync.crosshair === "off"
    ) {
      return;
    }
    const x = frame.timeToX(current.time);
    if (x === null || x < frame.plot.left || x > frame.plot.right) {
      return;
    }
    context.save();
    context.beginPath();
    context.rect(frame.plot.left, frame.plot.top, frame.plot.width, frame.plot.height);
    context.clip();
    context.strokeStyle = this.crosshairColor;
    context.lineWidth = 1;
    context.setLineDash([3, 4]);

    const crispX = Math.round(x) + 0.5;
    context.beginPath();
    context.moveTo(crispX, frame.plot.top);
    context.lineTo(crispX, frame.plot.bottom);
    context.stroke();

    if (this.sync.crosshair === "full" && current.yRatio !== null) {
      const y = frame.plot.top + current.yRatio * frame.plot.height;
      const crispY = Math.round(y) + 0.5;
      context.beginPath();
      context.moveTo(frame.plot.left, crispY);
      context.lineTo(frame.plot.right, crispY);
      context.stroke();
    }

    context.restore();
  }

  private disposeSlot(entry: InternalSlot): void {
    entry.slot.element.removeEventListener("pointerdown", entry.onPointerDown, true);
    entry.slot.element.removeEventListener("focusin", entry.onFocusIn);
    for (const unsubscribe of entry.unsubscribe) {
      unsubscribe();
    }
    entry.overlay?.remove();
    entry.overlay = null;
    this.crosshairOverlays.delete(entry.slot.id);
    entry.slot.chart.destroy();
    entry.slot.element.remove();
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new WickError("DISPOSED", "Chart layout is disposed");
    }
  }
}

function resolveSyncOptions(options: ChartLayoutOptions): ChartLayoutSyncOptions {
  return {
    timeRange: options.sync?.timeRange ?? options.syncTimeRange ?? true,
    crosshair: normalizeCrosshair(options.sync?.crosshair ?? options.syncCrosshair ?? "time"),
  };
}

function normalizeCrosshair(
  value: boolean | ChartLayoutCrosshairMode | undefined,
): ChartLayoutCrosshairMode {
  if (value === undefined || value === true || value === "time") {
    return "time";
  }
  if (value === false || value === "off") {
    return "off";
  }
  if (value === "full") {
    return "full";
  }
  throw new WickError("INVALID_ARGUMENT", "crosshair must be off, time, or full");
}

function mergeChartOptions(
  base: ChartOptions | undefined,
  override: ChartOptions | undefined,
): ChartOptions | undefined {
  if (!base) {
    return override;
  }
  if (!override) {
    return base;
  }
  return { ...base, ...override };
}

function validateColumns(columns: number): number {
  if (!Number.isInteger(columns) || columns < 1 || columns > MAX_COLUMNS) {
    throw new WickError("INVALID_ARGUMENT", `columns must be an integer from 1 to ${MAX_COLUMNS}`);
  }
  return columns;
}

function validateGap(gap: number): number {
  if (!Number.isFinite(gap) || gap < 0) {
    throw new WickError("INVALID_ARGUMENT", "gap must be a non-negative finite number");
  }
  return gap;
}

function validateSpan(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new WickError("INVALID_ARGUMENT", `${name} must be a positive integer`);
  }
  return value;
}

function validateSyncGroup(value: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new WickError("INVALID_ARGUMENT", "syncGroup must be a non-empty string");
  }
  return value;
}
