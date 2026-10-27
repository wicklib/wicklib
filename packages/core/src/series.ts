import { OhlcStore } from "./data/ohlc-store";
import { fail } from "./errors";
import type { SeriesRenderData } from "./render/chart-renderer";
import type {
  CandlestickSeriesOptions,
  OhlcData,
  PriceScaleApi,
  SeriesApi,
  SeriesType,
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
  priceScaleApi(): PriceScaleApi;
  removeSeries(series: Series): void;
}

/**
 * Internal series implementation. Only candlestick is supported in Phase 2.
 */
export class Series implements SeriesApi<OhlcData, CandlestickSeriesOptions> {
  readonly id: string;
  readonly paneId = "main";

  private readonly host: SeriesHost;
  private readonly store = new OhlcStore();
  private options: Required<CandlestickSeriesOptions>;
  private removed = false;

  constructor(
    host: SeriesHost,
    id: string,
    _type: SeriesType<OhlcData, CandlestickSeriesOptions>,
    options: CandlestickSeriesOptions | undefined,
  ) {
    this.host = host;
    this.id = id;

    if (options?.paneId !== undefined && options.paneId !== "main") {
      fail("NOT_IMPLEMENTED", "Only the default pane exists in Phase 2");
    }
    if (options?.priceScaleId !== undefined && options.priceScaleId !== "right") {
      fail("NOT_IMPLEMENTED", "Only the default right price scale exists in Phase 2");
    }

    this.options = mergeDefined<Required<CandlestickSeriesOptions>>(DEFAULT_OPTIONS, options);
  }

  setData(data: readonly OhlcData[]): void {
    this.assertAlive();
    this.store.setData(data);
    this.host.onSeriesDataChanged(this);
  }

  update(data: OhlcData): void {
    this.assertAlive();
    this.store.update(data);
    this.host.onSeriesDataChanged(this);
  }

  setOptions(options: Partial<CandlestickSeriesOptions>): void {
    this.assertAlive();

    if (options.paneId !== undefined && options.paneId !== this.paneId) {
      fail("NOT_IMPLEMENTED", "Only the default pane exists in Phase 2");
    }
    if (options.priceScaleId !== undefined && options.priceScaleId !== "right") {
      fail("NOT_IMPLEMENTED", "Only the default right price scale exists in Phase 2");
    }

    this.options = mergeDefined<Required<CandlestickSeriesOptions>>(this.options, options);
    this.host.requestRender();
  }

  priceScale(): PriceScaleApi {
    this.assertAlive();
    return this.host.priceScaleApi();
  }

  remove(): void {
    this.assertAlive();
    this.removed = true;
    this.host.removeSeries(this);
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
}
