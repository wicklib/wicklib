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
  type Unsubscribe,
  type VisibleRangeEvent,
} from "@wicklib/core";

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
}

/**
 * Serializable structural layout state. Chart state is owned by the host.
 */
export interface ChartLayoutSnapshot {
  version: 1;
  columns: number;
  gap: number;
  slots: ReadonlyArray<{
    id: string;
    rowSpan: number;
    columnSpan: number;
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
  /** Synchronize visible time ranges. Defaults to true. */
  syncTimeRange?: boolean;
  /** Synchronize the vertical crosshair time line. Defaults to true. */
  syncCrosshair?: boolean;
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
  /** Marks one chart as active. Pass null to clear. */
  setActiveChart(id: string | null): void;
  /** Returns the active chart id, or null. */
  activeChartId(): string | null;
  /** Subscribes to active chart changes. */
  onActiveChange(handler: (chartId: string | null) => void): Unsubscribe;
  /** Applies the active chart's visible range to every other chart. */
  syncNow(): void;
  /** Returns structural layout state for host persistence. */
  serialize(): ChartLayoutSnapshot;
  /** Destroys every chart and removes the layout root. */
  destroy(): void;
}

interface InternalSlot {
  readonly slot: ChartLayoutSlot;
  readonly unsubscribe: readonly Unsubscribe[];
  readonly overlay: ChartOverlayApi | null;
  readonly onPointerDown: () => void;
  readonly onFocusIn: () => void;
}

const DEFAULT_COLUMNS = 2;
const DEFAULT_GAP = 1;
const MAX_COLUMNS = 12;
const DEFAULT_CROSSHAIR_COLOR = "rgba(139, 149, 167, 0.6)";

/**
 * Creates a framework-agnostic grid of Wicklib charts.
 *
 * The layout owns chart creation, grid placement, time-range synchronization, and a
 * mirrored crosshair line. It does not own data, symbol state, accounts, or persistence.
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
  private readonly syncTimeRange: boolean;
  private readonly syncCrosshair: boolean;
  private readonly crosshairColor: string;
  private columns: number;
  private gap: number;
  private activeId: string | null = null;
  private counter = 0;
  private applyingRange = false;
  private crosshair: { sourceId: string; time: number } | null = null;
  private destroyed = false;

  constructor(container: HTMLElement, options: ChartLayoutOptions) {
    if (!container || typeof container.appendChild !== "function") {
      throw new WickError("INVALID_ARGUMENT", "createChartLayout requires a DOM container");
    }

    this.columns = validateColumns(options.columns ?? DEFAULT_COLUMNS);
    this.gap = validateGap(options.gap ?? DEFAULT_GAP);
    this.chartOptions = options.chartOptions;
    this.syncTimeRange = options.syncTimeRange ?? true;
    this.syncCrosshair = options.syncCrosshair ?? true;
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

    let overlay: ChartOverlayApi | null = null;
    if (this.syncCrosshair) {
      overlay = chart.addOverlay({
        id: "wicklib-layout-crosshair",
        draw: (context, frame) => {
          const current = this.crosshair;
          if (!current || current.sourceId === id) {
            return;
          }
          const x = frame.timeToX(current.time);
          if (x === null || x < frame.plot.left || x > frame.plot.right) {
            return;
          }
          const crispX = Math.round(x) + 0.5;
          context.save();
          context.beginPath();
          context.rect(frame.plot.left, frame.plot.top, frame.plot.width, frame.plot.height);
          context.clip();
          context.strokeStyle = this.crosshairColor;
          context.lineWidth = 1;
          context.setLineDash([3, 4]);
          context.beginPath();
          context.moveTo(crispX, frame.plot.top);
          context.lineTo(crispX, frame.plot.bottom);
          context.stroke();
          context.restore();
        },
      });
      this.crosshairOverlays.set(id, overlay);
    }

    const slot: ChartLayoutSlot = {
      id,
      chart,
      element,
      rowSpan,
      columnSpan,
    };
    this.slots.push({
      slot,
      unsubscribe: unsubscribes,
      overlay,
      onPointerDown,
      onFocusIn,
    });

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
    this.applyRange(source.slot.id, source.slot.chart.timeScale().getVisibleRange());
  }

  serialize(): ChartLayoutSnapshot {
    this.assertAlive();
    return {
      version: 1,
      columns: this.columns,
      gap: this.gap,
      slots: this.slots.map((entry) => ({
        id: entry.slot.id,
        rowSpan: entry.slot.rowSpan,
        columnSpan: entry.slot.columnSpan,
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
    if (!this.syncTimeRange || this.applyingRange) {
      return;
    }
    this.applyRange(sourceId, { from: event.from, to: event.to });
  }

  private applyRange(sourceId: string, range: { from: number; to: number }): void {
    if (!Number.isFinite(range.from) || !Number.isFinite(range.to) || range.to <= range.from) {
      return;
    }
    this.applyingRange = true;
    try {
      for (const entry of this.slots) {
        if (entry.slot.id === sourceId) {
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
    if (!this.syncCrosshair) {
      return;
    }
    if (event.time === null || event.point === null) {
      if (this.crosshair !== null) {
        this.crosshair = null;
        this.requestCrosshairRender();
      }
      return;
    }
    this.crosshair = { sourceId, time: event.time };
    this.requestCrosshairRender();
  }

  private requestCrosshairRender(): void {
    for (const overlay of this.crosshairOverlays.values()) {
      overlay.requestRender();
    }
  }

  private disposeSlot(entry: InternalSlot): void {
    entry.slot.element.removeEventListener("pointerdown", entry.onPointerDown, true);
    entry.slot.element.removeEventListener("focusin", entry.onFocusIn);
    for (const unsubscribe of entry.unsubscribe) {
      unsubscribe();
    }
    entry.overlay?.remove();
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
