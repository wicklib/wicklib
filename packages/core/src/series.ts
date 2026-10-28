import { DatafeedController, type DatafeedControllerHost } from "./data/datafeed-controller";
import { LineStore } from "./data/line-store";
import { OhlcStore } from "./data/ohlc-store";
import type { SeriesDataStore } from "./data/series-store";
import { fail, type WickError } from "./errors";
import type { SeriesRenderData } from "./render/chart-renderer";
import type {
  AreaSeriesOptions,
  CandlestickSeriesOptions,
  Datafeed,
  HistogramSeriesOptions,
  LineData,
  LineSeriesOptions,
  OhlcData,
  PriceLineApi,
  PriceLineOptions,
  PriceScaleApi,
  SeriesData,
  SeriesDatafeedOptions,
  SeriesMarker,
  SeriesOptions,
  SeriesType,
  VisibleRange,
} from "./types";
import { mergeDefined } from "./util";
import { VERSION } from "./version";

export type SeriesKind = "candlestick" | "line" | "area" | "histogram";

/**
 * Built-in candlestick series token.
 */
export const CandlestickSeries: SeriesType<OhlcData, CandlestickSeriesOptions> = Object.freeze({
  id: "candlestick",
  meta: Object.freeze({
    id: "com.wicklib.candlestick",
    name: "Candlestick",
    version: VERSION,
    license: "free" as const,
  }),
});

/**
 * Built-in line series token.
 */
export const LineSeries: SeriesType<LineData, LineSeriesOptions> = Object.freeze({
  id: "line",
  meta: Object.freeze({
    id: "com.wicklib.line",
    name: "Line",
    version: VERSION,
    license: "free" as const,
  }),
});

/**
 * Built-in area series token.
 */
export const AreaSeries: SeriesType<LineData, AreaSeriesOptions> = Object.freeze({
  id: "area",
  meta: Object.freeze({
    id: "com.wicklib.area",
    name: "Area",
    version: VERSION,
    license: "free" as const,
  }),
});

/**
 * Built-in histogram series token.
 */
export const HistogramSeries: SeriesType<LineData, HistogramSeriesOptions> = Object.freeze({
  id: "histogram",
  meta: Object.freeze({
    id: "com.wicklib.histogram",
    name: "Histogram",
    version: VERSION,
    license: "free" as const,
  }),
});

const SERIES_KINDS: ReadonlyMap<string, SeriesKind> = new Map([
  [CandlestickSeries.id, "candlestick"],
  [LineSeries.id, "line"],
  [AreaSeries.id, "area"],
  [HistogramSeries.id, "histogram"],
]);

interface PriceLineEntry {
  options: Required<PriceLineOptions>;
}

interface ResolvedCommonOptions {
  title: string;
  visible: boolean;
  paneId: string;
  priceScaleId: "right";
  lastValueVisible: boolean;
  priceLineVisible: boolean;
}

interface ResolvedCandlestickOptions extends ResolvedCommonOptions {
  upColor: string;
  downColor: string;
  wickUpColor: string;
  wickDownColor: string;
  borderVisible: boolean;
}

interface ResolvedLineOptions extends ResolvedCommonOptions {
  color: string;
  lineWidth: number;
  lineStyle: "solid" | "dotted" | "dashed";
}

interface ResolvedAreaOptions extends ResolvedLineOptions {
  topColor: string;
  bottomColor: string;
  lineColor: string;
}

interface ResolvedHistogramOptions extends ResolvedCommonOptions {
  color: string;
  base: number;
}

type ResolvedSeriesOptions =
  ResolvedCandlestickOptions | ResolvedLineOptions | ResolvedAreaOptions | ResolvedHistogramOptions;

const COMMON_DEFAULTS: ResolvedCommonOptions = {
  title: "",
  visible: true,
  paneId: "main",
  priceScaleId: "right",
  lastValueVisible: true,
  priceLineVisible: true,
};

const CANDLESTICK_DEFAULTS: ResolvedCandlestickOptions = {
  ...COMMON_DEFAULTS,
  upColor: "#26a69a",
  downColor: "#ef5350",
  wickUpColor: "#26a69a",
  wickDownColor: "#ef5350",
  borderVisible: false,
};

const LINE_DEFAULTS: ResolvedLineOptions = {
  ...COMMON_DEFAULTS,
  color: "#2962ff",
  lineWidth: 2,
  lineStyle: "solid",
};

const AREA_DEFAULTS: ResolvedAreaOptions = {
  ...LINE_DEFAULTS,
  topColor: "rgba(41,98,255,0.4)",
  bottomColor: "rgba(41,98,255,0)",
  lineColor: "#2962ff",
};

const HISTOGRAM_DEFAULTS: ResolvedHistogramOptions = {
  ...COMMON_DEFAULTS,
  color: "#26a69a",
  base: 0,
};

const PRICE_LINE_DEFAULTS: Omit<Required<PriceLineOptions>, "price"> = {
  color: "#2962ff",
  lineWidth: 1,
  lineStyle: "solid",
  lineVisible: true,
  axisLabelVisible: true,
  title: "",
  titlePosition: "axis",
};

const MARKER_POSITIONS = new Set([
  "aboveBar",
  "belowBar",
  "inBar",
  "atPriceTop",
  "atPriceBottom",
  "atPriceMiddle",
]);
const MARKER_SHAPES = new Set(["circle", "square", "arrowUp", "arrowDown"]);
const LINE_STYLES = new Set(["solid", "dotted", "dashed"]);
const PRICE_LINE_TITLE_POSITIONS = new Set(["axis", "plot"]);

export interface SeriesHost {
  assertAlive(): void;
  onSeriesDataChanged(series: Series): void;
  requestRender(): void;
  priceScaleApi(paneId: string): PriceScaleApi;
  removeSeries(series: Series): void;
  getVisibleRange(): VisibleRange;
  restoreVisibleRange(range: VisibleRange): void;
  isAtRightEdge(): boolean;
  fitContentIfDefault(): void;
  emitDataLoading(seriesId: string, loading: boolean): void;
  emitDatafeedError(seriesId: string, error: WickError): void;
}

/**
 * Internal series implementation for built-in series kinds.
 */
export class Series {
  readonly id: string;
  readonly paneId: string;
  readonly kind: SeriesKind;

  private readonly host: SeriesHost;
  private readonly store: OhlcStore | LineStore;
  private options: ResolvedSeriesOptions;
  private removed = false;
  private datafeedController: DatafeedController<SeriesData> | null = null;
  private readonly priceLines = new Map<string, PriceLineEntry>();
  private priceLineCounter = 0;
  private markers: readonly SeriesMarker[] = [];

  constructor(
    host: SeriesHost,
    id: string,
    type: { readonly id: string },
    options: SeriesOptions | undefined,
    paneId: string,
  ) {
    this.host = host;
    this.id = id;
    this.paneId = paneId;

    const kind = SERIES_KINDS.get(type.id);
    if (!kind) {
      fail("UNKNOWN_SERIES_TYPE", `Unsupported series type: ${type.id}`);
    }
    this.kind = kind;
    this.store = kind === "candlestick" ? new OhlcStore() : new LineStore();

    if (options?.priceScaleId !== undefined && options.priceScaleId !== "right") {
      fail("NOT_IMPLEMENTED", "Only the default right price scale exists");
    }

    this.options = resolveSeriesOptions(
      kind,
      (options ?? {}) as SeriesOptions & Record<string, unknown>,
    );
  }

  setData(data: readonly SeriesData[]): void {
    this.assertAlive();
    this.assertNoDatafeed("setData");
    this.writeData(data);
    this.host.onSeriesDataChanged(this);
  }

  update(data: SeriesData): void {
    this.assertAlive();
    this.assertNoDatafeed("update");
    this.updateData(data);
    this.host.onSeriesDataChanged(this);
  }

  setOptions(options: Partial<SeriesOptions> & Record<string, unknown>): void {
    this.assertAlive();

    if (options.paneId !== undefined && options.paneId !== this.paneId) {
      fail("NOT_IMPLEMENTED", "Moving a series between panes is not supported");
    }
    if (options.priceScaleId !== undefined && options.priceScaleId !== "right") {
      fail("NOT_IMPLEMENTED", "Only the default right price scale exists");
    }

    const merged = mergeDefined<Record<string, unknown>>(
      this.options as unknown as Record<string, unknown>,
      options,
    );
    this.options = resolveSeriesOptions(this.kind, merged);
    this.host.requestRender();
  }

  setDatafeed(feed: Datafeed<SeriesData>, options: SeriesDatafeedOptions): void {
    this.assertAlive();

    this.datafeedController?.stop();
    this.store.clear();

    const host: DatafeedControllerHost<SeriesData> = {
      getVisibleRange: () => this.host.getVisibleRange(),
      restoreVisibleRange: (range) => this.host.restoreVisibleRange(range),
      isAtRightEdge: () => this.host.isAtRightEdge(),
      fitContentIfDefault: () => this.host.fitContentIfDefault(),
      getDataBounds: () => {
        const first = this.store.firstTime();
        const last = this.store.lastTime();
        return first === null || last === null ? null : { first, last };
      },
      mergeData: (data) => {
        this.mergeData(data);
      },
      updateData: (data) => {
        this.updateData(data);
      },
      onSeriesDataChanged: () => this.host.onSeriesDataChanged(this),
      emitLoading: (loading) => this.host.emitDataLoading(this.id, loading),
      emitError: (error) => this.host.emitDatafeedError(this.id, error),
    };

    this.datafeedController = new DatafeedController(host, feed, options);
    this.datafeedController.start();
    this.host.onSeriesDataChanged(this);
  }

  clearDatafeed(): void {
    this.assertAlive();
    this.datafeedController?.stop();
    this.datafeedController = null;
    this.host.requestRender();
  }

  isLoading(): boolean {
    this.assertAlive();
    return this.datafeedController?.isLoading() ?? false;
  }

  createPriceLine(options: PriceLineOptions): PriceLineApi {
    this.assertAlive();
    const resolved = resolvePriceLine(options, PRICE_LINE_DEFAULTS);
    this.priceLineCounter += 1;
    const id = `price-line-${this.priceLineCounter}`;
    this.priceLines.set(id, { options: resolved });
    this.host.requestRender();

    return {
      applyOptions: (patch) => {
        this.assertAlive();
        const entry = this.priceLines.get(id);
        if (!entry) {
          return;
        }
        entry.options = resolvePriceLine({ ...entry.options, ...patch }, PRICE_LINE_DEFAULTS);
        this.host.requestRender();
      },
      remove: () => {
        if (this.priceLines.delete(id)) {
          this.host.requestRender();
        }
      },
    };
  }

  setMarkers(markers: readonly SeriesMarker[]): void {
    this.assertAlive();
    if (!Array.isArray(markers)) {
      fail("INVALID_ARGUMENT", "Markers must be an array");
    }
    this.markers = markers.map((marker, index) => validateMarker(marker, index));
    this.host.requestRender();
  }

  priceScale(): PriceScaleApi {
    this.assertAlive();
    return this.host.priceScaleApi(this.paneId);
  }

  remove(): void {
    this.assertAlive();
    this.datafeedController?.stop();
    this.datafeedController = null;
    this.removed = true;
    this.host.removeSeries(this);
  }

  /** Called by the chart when the visible range changes. */
  onViewChanged(): void {
    this.datafeedController?.onViewChange();
  }

  /** Called by the chart during destroy. */
  destroyInternal(): void {
    this.datafeedController?.stop();
    this.datafeedController = null;
    this.removed = true;
  }

  isVisible(): boolean {
    return this.options.visible;
  }

  getStore(): SeriesDataStore {
    return this.store;
  }

  getOhlcStore(): OhlcStore | null {
    return this.kind === "candlestick" ? (this.store as OhlcStore) : null;
  }

  priceRange(first: number, last: number): { min: number; max: number } | null {
    const range = this.store.minMax(first, last);
    if (!range) {
      return null;
    }
    if (this.kind === "histogram") {
      const base = (this.options as ResolvedHistogramOptions).base;
      range.min = Math.min(range.min, base);
      range.max = Math.max(range.max, base);
    }
    return range;
  }

  toRenderData(): SeriesRenderData {
    const common = {
      store: this.store,
      visible: this.options.visible,
      title: this.options.title,
      lastValueVisible: this.options.lastValueVisible,
      priceLineVisible: this.options.priceLineVisible,
      priceLines: Array.from(this.priceLines.values(), (entry) => entry.options),
      markers: this.markers,
    };

    if (this.kind === "candlestick") {
      const options = this.options as ResolvedCandlestickOptions;
      return {
        ...common,
        kind: "candlestick",
        store: this.store as OhlcStore,
        upColor: options.upColor,
        downColor: options.downColor,
        wickUpColor: options.wickUpColor,
        wickDownColor: options.wickDownColor,
        borderVisible: options.borderVisible,
      };
    }

    if (this.kind === "line") {
      const options = this.options as ResolvedLineOptions;
      return {
        ...common,
        kind: "line",
        store: this.store as LineStore,
        color: options.color,
        lineWidth: options.lineWidth,
        lineStyle: options.lineStyle,
      };
    }

    if (this.kind === "area") {
      const options = this.options as ResolvedAreaOptions;
      return {
        ...common,
        kind: "area",
        store: this.store as LineStore,
        color: options.lineColor,
        lineWidth: options.lineWidth,
        lineStyle: options.lineStyle,
        topColor: options.topColor,
        bottomColor: options.bottomColor,
      };
    }

    const options = this.options as ResolvedHistogramOptions;
    return {
      ...common,
      kind: "histogram",
      store: this.store as LineStore,
      color: options.color,
      base: options.base,
    };
  }

  private writeData(data: readonly SeriesData[]): void {
    if (this.kind === "candlestick") {
      (this.store as OhlcStore).setData(data as readonly OhlcData[]);
    } else {
      (this.store as LineStore).setData(data as readonly LineData[]);
    }
  }

  private updateData(data: SeriesData): void {
    if (this.kind === "candlestick") {
      (this.store as OhlcStore).update(data as OhlcData);
    } else {
      (this.store as LineStore).update(data as LineData);
    }
  }

  private mergeData(data: readonly SeriesData[]): void {
    if (this.kind === "candlestick") {
      (this.store as OhlcStore).merge(data as readonly OhlcData[]);
    } else {
      (this.store as LineStore).merge(data as readonly LineData[]);
    }
  }

  private assertAlive(): void {
    this.host.assertAlive();
    if (this.removed) {
      fail("DISPOSED", "Series is removed");
    }
  }

  private assertNoDatafeed(method: string): void {
    if (this.datafeedController) {
      fail("INVALID_ARGUMENT", `Series is driven by a datafeed; ${method} is not allowed`);
    }
  }
}

function resolveSeriesOptions(
  kind: SeriesKind,
  input: SeriesOptions & Record<string, unknown>,
): ResolvedSeriesOptions {
  const common: ResolvedCommonOptions = {
    title: stringOption(input, "title", COMMON_DEFAULTS.title),
    visible: booleanOption(input, "visible", COMMON_DEFAULTS.visible),
    paneId: stringOption(input, "paneId", COMMON_DEFAULTS.paneId),
    priceScaleId: "right",
    lastValueVisible: booleanOption(input, "lastValueVisible", COMMON_DEFAULTS.lastValueVisible),
    priceLineVisible: booleanOption(input, "priceLineVisible", COMMON_DEFAULTS.priceLineVisible),
  };

  if (kind === "candlestick") {
    return {
      ...common,
      upColor: stringOption(input, "upColor", CANDLESTICK_DEFAULTS.upColor),
      downColor: stringOption(input, "downColor", CANDLESTICK_DEFAULTS.downColor),
      wickUpColor: stringOption(input, "wickUpColor", CANDLESTICK_DEFAULTS.wickUpColor),
      wickDownColor: stringOption(input, "wickDownColor", CANDLESTICK_DEFAULTS.wickDownColor),
      borderVisible: booleanOption(input, "borderVisible", CANDLESTICK_DEFAULTS.borderVisible),
    };
  }

  if (kind === "histogram") {
    const base = numberOption(input, "base", HISTOGRAM_DEFAULTS.base);
    if (!Number.isFinite(base)) {
      fail("INVALID_ARGUMENT", "Histogram base must be finite");
    }
    return {
      ...common,
      color: stringOption(input, "color", HISTOGRAM_DEFAULTS.color),
      base,
    };
  }

  const lineWidth = numberOption(input, "lineWidth", LINE_DEFAULTS.lineWidth);
  if (!Number.isFinite(lineWidth) || lineWidth <= 0) {
    fail("INVALID_ARGUMENT", "Series lineWidth must be a positive number");
  }
  const lineStyle = stringOption(input, "lineStyle", LINE_DEFAULTS.lineStyle);
  if (!LINE_STYLES.has(lineStyle)) {
    fail("INVALID_ARGUMENT", "Invalid series lineStyle");
  }
  const resolvedLine = {
    ...common,
    color: stringOption(input, "color", LINE_DEFAULTS.color),
    lineWidth,
    lineStyle: lineStyle as ResolvedLineOptions["lineStyle"],
  };

  if (kind === "line") {
    return resolvedLine;
  }

  return {
    ...resolvedLine,
    topColor: stringOption(input, "topColor", AREA_DEFAULTS.topColor),
    bottomColor: stringOption(input, "bottomColor", AREA_DEFAULTS.bottomColor),
    lineColor: stringOption(input, "lineColor", resolvedLine.color),
  };
}

function stringOption(input: Record<string, unknown>, key: string, fallback: string): string {
  const value = input[key];
  return typeof value === "string" ? value : fallback;
}

function booleanOption(input: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = input[key];
  return typeof value === "boolean" ? value : fallback;
}

function numberOption(input: Record<string, unknown>, key: string, fallback: number): number {
  const value = input[key];
  return typeof value === "number" ? value : fallback;
}

function resolvePriceLine(
  options: PriceLineOptions,
  defaults: Omit<Required<PriceLineOptions>, "price">,
): Required<PriceLineOptions> {
  if (
    !options ||
    !Number.isFinite(options.price) ||
    !LINE_STYLES.has(options.lineStyle ?? defaults.lineStyle) ||
    !PRICE_LINE_TITLE_POSITIONS.has(options.titlePosition ?? defaults.titlePosition) ||
    !Number.isFinite(options.lineWidth ?? defaults.lineWidth) ||
    (options.lineWidth ?? defaults.lineWidth) <= 0
  ) {
    fail("INVALID_ARGUMENT", "Invalid price line options");
  }
  return {
    price: options.price,
    color: options.color ?? defaults.color,
    lineWidth: options.lineWidth ?? defaults.lineWidth,
    lineStyle: options.lineStyle ?? defaults.lineStyle,
    lineVisible: options.lineVisible ?? defaults.lineVisible,
    axisLabelVisible: options.axisLabelVisible ?? defaults.axisLabelVisible,
    title: options.title ?? defaults.title,
    titlePosition: options.titlePosition ?? defaults.titlePosition,
  };
}

function validateMarker(marker: SeriesMarker, index: number): SeriesMarker {
  if (
    !marker ||
    !Number.isFinite(marker.time) ||
    !MARKER_POSITIONS.has(marker.position) ||
    (marker.shape !== undefined && !MARKER_SHAPES.has(marker.shape)) ||
    (marker.size !== undefined && (!Number.isFinite(marker.size) || marker.size <= 0))
  ) {
    fail("INVALID_ARGUMENT", "Invalid series marker", { index });
  }
  if (
    (marker.position === "atPriceTop" ||
      marker.position === "atPriceBottom" ||
      marker.position === "atPriceMiddle") &&
    !Number.isFinite(marker.price)
  ) {
    fail("INVALID_ARGUMENT", "Price markers require a finite price", { index });
  }
  return { ...marker };
}
