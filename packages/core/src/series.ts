import { DatafeedController, type DatafeedControllerHost } from "./data/datafeed-controller";
import { OhlcStore } from "./data/ohlc-store";
import { fail, type WickError } from "./errors";
import type { SeriesRenderData } from "./render/chart-renderer";
import type {
  CandlestickSeriesOptions,
  Datafeed,
  OhlcData,
  PriceScaleApi,
  SeriesApi,
  SeriesDatafeedOptions,
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
