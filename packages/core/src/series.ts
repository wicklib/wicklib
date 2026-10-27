import { DatafeedController, type DatafeedControllerHost } from "./data/datafeed-controller";
import { OhlcStore } from "./data/ohlc-store";
import { fail, type WickError } from "./errors";
import type { SeriesRenderData } from "./render/chart-renderer";
import type {
  CandlestickSeriesOptions,
  Datafeed,
  OhlcData,
  PriceLineApi,
  PriceLineOptions,
  PriceScaleApi,
  SeriesApi,
  SeriesDatafeedOptions,
  SeriesMarker,
  SeriesType,
  VisibleRange,
} from "./types";
import { mergeDefined } from "./util";
import { VERSION } from "./version";

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

interface PriceLineEntry {
  options: Required<PriceLineOptions>;
}

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
const PRICE_LINE_STYLES = new Set(["solid", "dotted", "dashed"]);
const PRICE_LINE_TITLE_POSITIONS = new Set(["axis", "plot"]);

const DEFAULT_OPTIONS: Required<CandlestickSeriesOptions> = {
  title: "",
  visible: true,
  paneId: "main",
  priceScaleId: "right",
  lastValueVisible: true,
  priceLineVisible: true,
  upColor: "#26a69a",
  downColor: "#ef5350",
  wickUpColor: "#26a69a",
  wickDownColor: "#ef5350",
  borderVisible: false,
};

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
 * Internal series implementation. Only candlestick is supported in Phase 2.
 */
export class Series implements SeriesApi<OhlcData, CandlestickSeriesOptions> {
  readonly id: string;
  readonly paneId: string;

  private readonly host: SeriesHost;
  private readonly store = new OhlcStore();
  private options: Required<CandlestickSeriesOptions>;
  private removed = false;
  private datafeedController: DatafeedController<OhlcData> | null = null;
  private readonly priceLines = new Map<string, PriceLineEntry>();
  private priceLineCounter = 0;
  private markers: readonly SeriesMarker[] = [];

  constructor(
    host: SeriesHost,
    id: string,
    _type: SeriesType<OhlcData, CandlestickSeriesOptions>,
    options: CandlestickSeriesOptions | undefined,
    paneId: string,
  ) {
    this.host = host;
    this.id = id;
    this.paneId = paneId;

    if (options?.priceScaleId !== undefined && options.priceScaleId !== "right") {
      fail("NOT_IMPLEMENTED", "Only the default right price scale exists in Phase 3");
    }

    this.options = mergeDefined<Required<CandlestickSeriesOptions>>(DEFAULT_OPTIONS, options);
  }

  setData(data: readonly OhlcData[]): void {
    this.assertAlive();
    this.assertNoDatafeed("setData");
    this.store.setData(data);
    this.host.onSeriesDataChanged(this);
  }

  update(data: OhlcData): void {
    this.assertAlive();
    this.assertNoDatafeed("update");
    this.store.update(data);
    this.host.onSeriesDataChanged(this);
  }

  setOptions(options: Partial<CandlestickSeriesOptions>): void {
    this.assertAlive();

    if (options.paneId !== undefined && options.paneId !== this.paneId) {
      fail("NOT_IMPLEMENTED", "Moving a series between panes is not supported");
    }
    if (options.priceScaleId !== undefined && options.priceScaleId !== "right") {
      fail("NOT_IMPLEMENTED", "Only the default right price scale exists in Phase 2");
    }

    this.options = mergeDefined<Required<CandlestickSeriesOptions>>(this.options, options);
    this.host.requestRender();
  }

  setDatafeed(feed: Datafeed<OhlcData>, options: SeriesDatafeedOptions): void {
    this.assertAlive();

    this.datafeedController?.stop();
    this.store.clear();

    const host: DatafeedControllerHost<OhlcData> = {
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
        this.store.merge(data);
      },
      updateData: (data) => {
        this.store.update(data);
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

  getStore(): OhlcStore {
    return this.store;
  }

  toRenderData(): SeriesRenderData {
    return {
      bars: this.store,
      visible: this.options.visible,
      title: this.options.title,
      upColor: this.options.upColor,
      downColor: this.options.downColor,
      wickUpColor: this.options.wickUpColor,
      wickDownColor: this.options.wickDownColor,
      borderVisible: this.options.borderVisible,
      lastValueVisible: this.options.lastValueVisible,
      priceLineVisible: this.options.priceLineVisible,
      priceLines: Array.from(this.priceLines.values(), (entry) => entry.options),
      markers: this.markers,
    };
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

function resolvePriceLine(
  options: PriceLineOptions,
  defaults: Omit<Required<PriceLineOptions>, "price">,
): Required<PriceLineOptions> {
  if (
    !options ||
    !Number.isFinite(options.price) ||
    !PRICE_LINE_STYLES.has(options.lineStyle ?? defaults.lineStyle) ||
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
