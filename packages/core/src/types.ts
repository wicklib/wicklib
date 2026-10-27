import type { WickError } from "./errors";

/**
 * Milliseconds since the Unix epoch, UTC.
 */
export type Time = number;

/**
 * Opaque interval label, for example `1m`, `1h`, or `1D`.
 */
export type Interval = string;

/**
 * Base shape for any series data point.
 */
export interface SeriesData {
  time: Time;
}

/**
 * OHLC bar used by candlestick series.
 */
export interface OhlcData extends SeriesData {
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Single-value data point used by line, area, and histogram series.
 */
export interface LineData extends SeriesData {
  value: number;
}

/**
 * A point in CSS pixels relative to the chart container.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * A visible time range.
 */
export interface VisibleRange {
  from: Time;
  to: Time;
}

/**
 * A visible price range.
 */
export interface PriceRange {
  min: number;
  max: number;
}

/**
 * License tier attached to an extension.
 */
export type LicenseTier = "free" | "pro";

/**
 * Metadata every extension must provide.
 */
export interface ExtensionMeta {
  /** Reverse-DNS identifier, for example `com.wicklib.orderflow`. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Semver of the extension. */
  version: string;
  /** Tier required to use the extension. */
  license: LicenseTier;
}

/**
 * Kinds of extension a chart can host.
 */
export type ExtensionKind = "series" | "indicator" | "drawing" | "script-runtime" | "feature";

/**
 * Base contract for anything supplied through {@link ChartOptions.extensions}.
 */
export interface WickExtension {
  readonly kind: ExtensionKind;
  readonly meta: ExtensionMeta;
}

/**
 * A series type token. Built-ins are imported; third-party types use the same shape.
 */
export interface SeriesType<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- phantom type carrier
  TData extends SeriesData = SeriesData,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- phantom type carrier
  TOptions extends SeriesOptions = SeriesOptions,
> {
  readonly id: string;
  readonly meta: ExtensionMeta;
}

/**
 * Chart-wide layout options.
 */
export interface LayoutOptions {
  /** Canvas background colour. */
  background?: string;
  /** Axis and label text colour. */
  textColor?: string;
  /** Base font size in CSS pixels. */
  fontSize?: number;
}

/**
 * Grid line options.
 */
export interface GridLineOptions {
  /** Line colour. */
  color?: string;
  /** Whether the lines are drawn. */
  visible?: boolean;
}

/**
 * Grid options.
 */
export interface GridOptions {
  vertLines?: GridLineOptions;
  horzLines?: GridLineOptions;
}

/**
 * Crosshair line options.
 */
export interface CrosshairLineOptions {
  color?: string;
  visible?: boolean;
  width?: number;
  style?: "solid" | "dotted" | "dashed";
}

/**
 * Crosshair options.
 */
export interface CrosshairOptions {
  /** `normal` follows the pointer, `magnet` snaps to the nearest bar price. */
  mode?: "normal" | "magnet" | "hidden";
  color?: string;
  labelBackground?: string;
  vertLine?: CrosshairLineOptions;
  horzLine?: CrosshairLineOptions;
}

/**
 * Time scale options.
 */
export interface TimeScaleOptions {
  /** Pixels per bar. */
  barSpacing?: number;
  /** Empty bars reserved to the right of the last bar. */
  rightOffset?: number;
  /** Lower bound for `barSpacing`. */
  minBarSpacing?: number;
  /** Upper bound for `barSpacing`. */
  maxBarSpacing?: number;
  /** Show time labels in the time axis. */
  timeVisible?: boolean;
  /** Show seconds in time labels. */
  secondsVisible?: boolean;
}

/**
 * Price scale options.
 */
export interface PriceScaleOptions {
  /** `logarithmic` is not implemented in Phase 2 and throws. */
  mode?: "normal" | "logarithmic";
  /** Recompute the range from visible data. */
  autoScale?: boolean;
  /** Flip the vertical axis. */
  invertScale?: boolean;
  /** Fraction of the range reserved above and below the data. */
  scaleMargins?: {
    top: number;
    bottom: number;
  };
  /** Draw the border between the plot and the price axis. */
  borderVisible?: boolean;
}

/**
 * Pane options. Panes are implemented in Phase 3.
 */
export interface PaneOptions {
  height?: number;
}

/**
 * Options accepted by {@link createChart}.
 */
export interface ChartOptions {
  /** Track the container size. Defaults to true. */
  autoSize?: boolean;
  /** Fixed width when `autoSize` is false. */
  width?: number;
  /** Fixed height when `autoSize` is false. */
  height?: number;
  /** BCP-47 locale used for number and time formatting. Defaults to `en-US`. */
  locale?: string;
  /** IANA time zone used for time labels. Defaults to `UTC`. */
  timezone?: string;
  layout?: LayoutOptions;
  grid?: GridOptions;
  crosshair?: CrosshairOptions;
  timeScale?: TimeScaleOptions;
  priceScale?: PriceScaleOptions;
  /** Extensions snapshotted at creation. Cannot be changed later. */
  extensions?: readonly WickExtension[];
}

/**
 * Options shared by every series type.
 */
export interface SeriesOptions {
  /** Display name. Drawn in the series legend. */
  title?: string;
  /** Whether the series is rendered. */
  visible?: boolean;
  /** Pane identifier. Only the default pane exists in Phase 2. */
  paneId?: string;
  /** Price scale identifier. Only the default right scale exists in Phase 2. */
  priceScaleId?: string;
  /** Draw a label for the most recent value. */
  lastValueVisible?: boolean;
  /** Draw a horizontal line at the most recent value. */
  priceLineVisible?: boolean;
}

/**
 * Candlestick series options.
 */
export interface CandlestickSeriesOptions extends SeriesOptions {
  upColor?: string;
  downColor?: string;
  wickUpColor?: string;
  wickDownColor?: string;
  /** Draw a border around each candle body. */
  borderVisible?: boolean;
}

/**
 * Line series options. The line renderer is not implemented in Phase 2.
 */
export interface LineSeriesOptions extends SeriesOptions {
  color?: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dotted" | "dashed";
}

/**
 * Payload for the `ready` event.
 */
export type ReadyEvent = void;

/**
 * Payload for the `crosshair` event.
 */
export interface CrosshairEvent {
  time: Time | null;
  price: number | null;
  paneId: string;
  point: Point | null;
}

/**
 * Payload for the `visible-range` event.
 */
export interface VisibleRangeEvent {
  from: Time;
  to: Time;
  paneId: string;
}

/**
 * Payload for the `click` event.
 */
export interface ChartClickEvent {
  time: Time | null;
  price: number | null;
  paneId: string;
  point: Point;
  button: "left" | "middle" | "right";
}

/**
 * Payload for the `error` event.
 */
export interface ChartErrorEvent {
  error: WickError;
  source: "chart" | "series" | "extension" | "datafeed";
}

/**
 * Map of chart events to their payloads.
 */
export interface ChartEventMap {
  ready: ReadyEvent;
  crosshair: CrosshairEvent;
  "visible-range": VisibleRangeEvent;
  click: ChartClickEvent;
  error: ChartErrorEvent;
}

/**
 * Returned by {@link ChartApi.on}. Idempotent and safe after `destroy()`.
 */
export type Unsubscribe = () => void;

/**
 * Time scale controls.
 */
export interface TimeScaleApi {
  getVisibleRange(): VisibleRange;
  setVisibleRange(range: VisibleRange): void;
  fitContent(): void;
  scrollToTime(time: Time): void;
  setOptions(options: Partial<TimeScaleOptions>): void;
}

/**
 * Price scale controls.
 */
export interface PriceScaleApi {
  getVisibleRange(): PriceRange;
  setVisibleRange(range: PriceRange): void;
  setAutoScale(enabled: boolean): void;
}

/**
 * A pane. Implemented in Phase 3.
 */
export interface PaneApi {
  readonly id: string;
  setHeight(height: number): void;
  remove(): void;
}

/**
 * A live series.
 */
export interface SeriesApi<
  TData extends SeriesData = SeriesData,
  TOptions extends SeriesOptions = SeriesOptions,
> {
  readonly id: string;
  readonly paneId: string;
  setData(data: readonly TData[]): void;
  update(data: TData): void;
  setOptions(options: Partial<TOptions>): void;
  priceScale(): PriceScaleApi;
  remove(): void;
}

/**
 * A live chart.
 */
export interface ChartApi {
  addSeries<TData extends SeriesData, TOptions extends SeriesOptions>(
    type: SeriesType<TData, TOptions>,
    options?: TOptions,
  ): SeriesApi<TData, TOptions>;
  addPane(options?: PaneOptions): PaneApi;
  timeScale(): TimeScaleApi;
  setOptions(options: Partial<ChartOptions>): void;
  on<K extends keyof ChartEventMap>(
    event: K,
    handler: (payload: ChartEventMap[K]) => void,
  ): Unsubscribe;
  resize(): void;
  destroy(): void;
}

/**
 * Features that can be licensed.
 */
export type Feature =
  "orderflow" | "volume-profile" | "panes" | "layouts" | "strategy" | "alerts" | "script-functions";

/**
 * Runtime license context exposed to commercial extensions.
 */
export interface LicenseContext {
  hasFeature(feature: Feature): boolean;
}
