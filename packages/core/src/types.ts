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
  /** Optional volume. Non-negative and finite when present. */
  volume?: number;
}

/**
 * Single-value data point used by line, area, and histogram series.
 */
export interface LineData extends SeriesData {
  value: number;
}

/**
 * Context passed to a datafeed request. The signal aborts when the request is no longer
 * needed.
 */
export interface DatafeedContext {
  signal: AbortSignal;
}

/**
 * A request for series data.
 *
 * Provide either `count` for the initial load, or `from`/`to` for a range load. The core
 * never sends both.
 */
export interface DataRequest {
  symbol: string;
  interval: Interval;
  /** Inclusive lower bound. */
  from?: Time;
  /** Inclusive upper bound. */
  to?: Time;
  /** Number of latest points to return. */
  count?: number;
}

/**
 * A datafeed response. `data` must be ascending and unique by time.
 */
export interface DataResponse<TData extends SeriesData = SeriesData> {
  data: readonly TData[];
  /** True when no data exists earlier than the requested range. */
  noDataBefore?: boolean;
  /** True when no data exists later than the requested range. */
  noDataAfter?: boolean;
}

/**
 * Realtime subscription request.
 */
export interface SubscriptionRequest {
  symbol: string;
  interval: Interval;
}

/**
 * Turns symbol and interval into data. The feed owns transport, authentication, caching,
 * retries, and reconnection.
 */
export interface Datafeed<TData extends SeriesData = SeriesData> {
  getData(request: DataRequest, context: DatafeedContext): Promise<DataResponse<TData>>;

  subscribe?(
    request: SubscriptionRequest,
    listener: (data: TData) => void,
    onError: (error: unknown) => void,
  ): Unsubscribe;
}

/**
 * How the time view is positioned after a datafeed's initial load.
 *
 * `auto` fits only when the host has not chosen a view. `fit` always fits the loaded
 * data. `preserve` keeps the current view.
 */
export type DatafeedInitialView = "auto" | "fit" | "preserve";

/**
 * Options for attaching a datafeed to a series.
 */
export interface SeriesDatafeedOptions {
  symbol: string;
  interval: Interval;
  /** Points requested on the initial load. Defaults to 500. */
  initialBars?: number;
  /** Initial time view behavior. Defaults to `auto`. */
  initialView?: DatafeedInitialView;
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
  /** Base text colour used by chart chrome outside the axes. */
  textColor?: string;
  /** Base font size in CSS pixels. */
  fontSize?: number;
  /** Both-axis border colour; defaults to grid line colours. */
  axisLineColor?: string;
  /** Axis label text colour; defaults to `textColor`. */
  axisTextColor?: string;
  /** Axis label font size; defaults to `fontSize`. */
  axisFontSize?: number;
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
 * Pointer and wheel interaction controls.
 */
export interface InteractionOptions {
  /** Wheel pans and zooms. Defaults to true. */
  wheel?: boolean;
  /** Pointer drag pans the time scale and a manual price scale. Defaults to true. */
  drag?: boolean;
  /** Two-pointer pinch zooms. Defaults to true. */
  pinch?: boolean;
  /** Dragging the price axis changes its range. Defaults to true. */
  axisDrag?: boolean;
  /** Double-clicking the price axis restores auto-scale. Defaults to true. */
  axisDoubleClickReset?: boolean;
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
  /** `normal` follows the pointer, `magnet` keeps magnet snapping active, `hidden` disables it. */
  mode?: "normal" | "magnet" | "hidden";
  /** Strength used when magnet is active. Defaults to weak. */
  magnet?: "weak" | "strong";
  /** Temporary magnet strength while Ctrl or Command is held. Defaults to weak. */
  modifierMagnet?: "off" | "weak" | "strong";
  color?: string;
  /** Crosshair label background. */
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
  /** Maximum number of bars visible when zoomed out. Defaults to unlimited. */
  maxVisibleBars?: number;
  /** Optional trading calendar for session-aware labels. Use null to clear it. */
  calendar?: TradingCalendar | null;
  /** Keep closed sessions compressed or show them as fixed-width gaps. */
  gapMode?: SessionGapMode;
  /** Width of each shown session gap in CSS pixels. Defaults to 12. */
  gapWidth?: number;
  /** Show time labels in the time axis. */
  timeVisible?: boolean;
  /** Show seconds in time labels. */
  secondsVisible?: boolean;
  /** Draw the bottom border of the time axis. Defaults to true. */
  borderVisible?: boolean;
}

/**
 * Price label formatting for instrument-specific precision.
 */
export interface PriceFormatOptions {
  /**
   * Fixed number of decimal places. Overrides precision inferred from `minMove` or
   * generated ticks.
   */
  precision?: number;
  /**
   * Smallest price increment. Used to infer decimal precision when `precision` is
   * omitted. Does not constrain generated tick values.
   */
  minMove?: number;
}

/**
 * Price scale options.
 */
export interface PriceScaleOptions {
  /** Linear or logarithmic price mapping. Defaults to linear. */
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
  /** Instrument-specific price label formatting. */
  priceFormat?: PriceFormatOptions;
}

/**
 * Pane options. Panes are implemented in Phase 3.
 */
export interface PaneOptions {
  /** Preferred height in CSS pixels. Remaining height is distributed equally. */
  height?: number;
  /** Price scale options for this pane. */
  priceScale?: PriceScaleOptions;
}

/**
 * Options accepted by {@link createChart}.
 */
export interface ChartOptions {
  /** Rendering backend. Experimental; defaults to Canvas2D and falls back if WebGL2 fails. */
  renderer?: "canvas2d" | "webgl2";
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
  interaction?: InteractionOptions;
  timeScale?: TimeScaleOptions;
  priceScale?: PriceScaleOptions;
  /** Extensions snapshotted at creation. Cannot be changed later. */
  extensions?: readonly WickExtension[];
}

/**
 * A horizontal price line drawn by a series.
 */
export type PriceLineStyle = "solid" | "dotted" | "dashed";

/**
 * Where a price line's title is rendered.
 *
 * `axis` keeps the title in the price-axis label. `plot` draws it inside the pane near
 * the right edge of the line.
 */
export type PriceLineTitlePosition = "axis" | "plot";

/**
 * Options for a series price line. The line is rendered across the series pane and can
 * optionally show a label on the price axis.
 */
export interface PriceLineOptions {
  price: number;
  /** Stable host-facing id for drag events. Generated when omitted. */
  id?: string;
  color?: string;
  lineWidth?: number;
  lineStyle?: PriceLineStyle;
  /** Draw the horizontal line. Defaults to true. */
  lineVisible?: boolean;
  /** Draw the value label on the price axis. Defaults to true. */
  axisLabelVisible?: boolean;
  /** Optional label prefix shown before the price. */
  title?: string;
  /** Where the title is rendered. Defaults to `axis`. */
  titlePosition?: PriceLineTitlePosition;
  /** Enable pointer and keyboard dragging. Defaults to false. */
  draggable?: boolean;
  /** Price boundary while dragging. */
  dragConstraint?: PriceLineDragConstraint;
  /** Optional price snapping while dragging. */
  dragSnap?: PriceLineDragSnap;
  onDragStart?: (event: PriceLineDragEvent) => void;
  onDragMove?: (event: PriceLineDragEvent) => void;
  onDragEnd?: (event: PriceLineDragEvent) => void;
}

/**
 * Boundary applied while dragging a price line.
 */
export interface PriceLineDragConstraint {
  kind: "none" | "above" | "below" | "range";
  min?: number;
  max?: number;
}

/**
 * Price snapping mode for draggable price lines.
 */
export type PriceLineDragSnap = "none" | "tick" | "magnet";

/**
 * Event emitted while a price line is interactively dragged.
 */
export interface PriceLineDragEvent {
  id: string;
  phase: "start" | "move" | "end" | "cancel";
  price: number;
  previousPrice: number;
  originalPrice: number;
  pointer: { x: number; y: number };
  source: "pointer" | "keyboard" | "api";
}

/**
 * A live price line.
 */
export interface PriceLineApi {
  applyOptions(options: Partial<PriceLineOptions>): void;
  getPrice(): number;
  setPrice(price: number, source?: "api" | "user"): void;
  setDraggable(draggable: boolean): void;
  setDragConstraint(constraint: PriceLineDragConstraint): void;
  focus(): void;
  remove(): void;
}

/**
 * Marker placement relative to a bar or an explicit price.
 */
export type SeriesMarkerPosition =
  "aboveBar" | "belowBar" | "inBar" | "atPriceTop" | "atPriceBottom" | "atPriceMiddle";

/**
 * Marker shape.
 */
export type SeriesMarkerShape = "circle" | "square" | "arrowUp" | "arrowDown";

/**
 * A marker attached to a series.
 *
 * `price` is required for `atPriceTop`, `atPriceBottom`, and `atPriceMiddle`.
 */
export interface SeriesMarker {
  time: Time;
  position: SeriesMarkerPosition;
  shape?: SeriesMarkerShape;
  color?: string;
  text?: string;
  /** Relative shape size. Defaults to 1. */
  size?: number;
  price?: number;
}

/**
 * Which price the last-value label represents.
 *
 * `visible` follows the right edge of the chart, `data` follows the newest data point, and
 * `both` renders both labels.
 */
export type LastValueMode = "visible" | "data" | "both";

/**
 * Information about a series price value.
 */
export interface SeriesValueInfo {
  value: number;
  time: Time;
  index: number;
  /** True when the value's time is inside the current visible time range. */
  visible: boolean;
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
  /** Which last value the label represents. Defaults to `visible`. */
  lastValueMode?: LastValueMode;
  /** Draw a horizontal line at the visible last value. */
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
 * Line series options.
 */
export interface LineSeriesOptions extends SeriesOptions {
  color?: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dotted" | "dashed";
}

/**
 * Area series options. The area fills from the line to the bottom of the pane.
 */
export interface AreaSeriesOptions extends LineSeriesOptions {
  /** Fill gradient start at the line. Defaults to a translucent line colour. */
  topColor?: string;
  /** Fill gradient end at the pane bottom. Defaults to transparent. */
  bottomColor?: string;
  /** Line colour. Defaults to the line series colour. */
  lineColor?: string;
}

/**
 * Histogram series options.
 */
export interface HistogramSeriesOptions extends SeriesOptions {
  color?: string;
  /** Baseline in price units. Defaults to 0. */
  base?: number;
}

/**
 * A value accepted by an indicator input.
 */
export type IndicatorInputValue = number | boolean | string;

/**
 * Resolved indicator inputs keyed by input id.
 */
export type IndicatorInputs = Record<string, IndicatorInputValue>;

/**
 * Price source used by the built-in indicators.
 */
export type SourceValue = "open" | "high" | "low" | "close" | "hl2" | "hlc3" | "ohlc4";

/**
 * Declares one indicator input for the host UI and validation.
 */
export interface IndicatorInputDefinition {
  id: string;
  name: string;
  type: "number" | "boolean" | "string" | "source";
  defaultValue: IndicatorInputValue;
  min?: number;
  max?: number;
  step?: number;
  /** Allowed values for string and source inputs. */
  options?: readonly string[];
}

/**
 * Declares one plotted output of an indicator.
 */
export interface IndicatorPlotDefinition {
  id: string;
  title: string;
  type: "line" | "histogram" | "area";
  color?: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dotted" | "dashed";
  /** Histogram or area baseline. Defaults to 0. */
  baseline?: number;
  /** Initial visibility. Defaults to true. */
  visible?: boolean;
}

/**
 * Read-only view of the source bars an indicator computes over.
 */
export interface IndicatorBars {
  readonly length: number;
  timeAt(index: number): Time;
  openAt(index: number): number;
  highAt(index: number): number;
  lowAt(index: number): number;
  closeAt(index: number): number;
  /** Undefined when the source did not provide volume. */
  volumeAt(index: number): number | undefined;
}

/**
 * Context passed to an indicator's compute function.
 */
export interface IndicatorContext<TInputs extends IndicatorInputs> {
  readonly bars: IndicatorBars;
  readonly inputs: Readonly<TInputs>;
}

/**
 * One array per plot id, index-aligned with the source bars. `null` marks a missing value.
 */
export type IndicatorOutput = Readonly<Record<string, ReadonlyArray<number | null>>>;

/**
 * A pure indicator definition.
 */
export interface IndicatorDefinition<TInputs extends IndicatorInputs = IndicatorInputs> {
  readonly meta: ExtensionMeta;
  readonly inputs: readonly IndicatorInputDefinition[];
  readonly plots: readonly IndicatorPlotDefinition[];
  /** Default placement. Defaults to "main". */
  readonly defaultPane?: "main" | "separate";
  compute(context: IndicatorContext<TInputs>): IndicatorOutput;
}

/**
 * Options for adding an indicator to a chart.
 */
export interface AddIndicatorOptions<TInputs extends IndicatorInputs = IndicatorInputs> {
  /** Defaults to the first series in the chart. */
  sourceSeriesId?: string;
  /** `main` uses the source pane, `separate` creates one, a string uses an existing pane. */
  pane?: "main" | "separate" | string;
  inputs?: Partial<TInputs>;
}

/**
 * Runtime plot overrides.
 */
export interface IndicatorPlotOptions {
  color?: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dotted" | "dashed";
  visible?: boolean;
}

/**
 * A live indicator.
 */
export interface IndicatorApi<TInputs extends IndicatorInputs = IndicatorInputs> {
  readonly id: string;
  readonly sourceSeriesId: string;
  readonly paneId: string;
  /** Read-only copy of the resolved inputs. */
  getInputs(): Readonly<TInputs>;
  /** Read-only copy of the effective options for one plot. */
  getPlotOptions(plotId: string): Readonly<IndicatorPlotOptions>;
  setInputs(inputs: Partial<TInputs>): void;
  setPlotOptions(plotId: string, options: IndicatorPlotOptions): void;
  remove(): void;
}

/**
 * A drawing anchor in data space. Anchors survive pan, zoom, and resize.
 */
export interface DrawingAnchor {
  time: Time;
  price: number;
}

/**
 * Drawing line style.
 */
export type DrawingLineStyle = "solid" | "dotted" | "dashed";

/**
 * Placement of drawing labels relative to their anchor.
 */
export type DrawingLabelPlacement = "auto" | "above" | "below";

/**
 * A setting that can be edited for a drawing tool.
 */
export type DrawingSetting =
  | "color"
  | "lineWidth"
  | "lineStyle"
  | "lineOpacity"
  | "fillColor"
  | "fillOpacity"
  | "fillVisible"
  | "showLabels"
  | "labelPlacement"
  | "labelFontSize"
  | "labelBackgroundVisible"
  | "showLine"
  | "extendLeft"
  | "extendRight"
  | "showMidpoint"
  | "priceLabels"
  | "timeLabels"
  | "stopColor"
  | "targetColor"
  | "extend"
  | "extendTop"
  | "extendBottom"
  | "labelTextColor"
  | "topLineColor"
  | "topLineWidth"
  | "topLineStyle"
  | "middleLineColor"
  | "middleLineWidth"
  | "middleLineStyle"
  | "middleLineVisible"
  | "bottomLineColor"
  | "bottomLineWidth"
  | "bottomLineStyle"
  | "channelBackgroundVisible"
  | "fontFamily"
  | "backgroundColor"
  | "backgroundOpacity"
  | "borderColor"
  | "borderWidth"
  | "borderRadius"
  | "padding"
  | "fibLevels"
  | "fibBackgroundVisible"
  | "accountSize"
  | "riskPercent"
  | "leverage"
  | "contractSize"
  | "positionStatsFields"
  | "stats"
  | "statsFields"
  | "statsPosition"
  | "text"
  | "textColor"
  | "textStyle"
  | "textAlign"
  | "textVerticalAlign"
  | "fontSize"
  | "locked"
  | "visible";

/**
 * A drawing colour. `theme` resolves to the chart's layout text colour.
 */
export type DrawingColor = string | "theme";

/**
 * Font style for drawing text.
 */
export type DrawingTextStyle = "normal" | "bold" | "italic" | "bold-italic";

/**
 * Horizontal text alignment.
 */
export type DrawingTextAlign = "left" | "center" | "right";

/**
 * Vertical text alignment.
 */
export type DrawingTextVerticalAlign = "top" | "middle" | "bottom";

/**
 * Endpoint price labels on the price axis.
 */
export type DrawingPriceLabelsMode = "never" | "selected" | "always";

/**
 * When to show drawing anchor times on the time axis.
 */
export type DrawingTimeLabelsMode = "never" | "selected" | "always";

/**
 * Drawing stats box visibility.
 */
export type DrawingStatsMode = "off" | "selected" | "always";

/**
 * One value shown in a drawing stats box.
 */
export type DrawingStatsField =
  | "range"
  | "change"
  | "bars"
  | "date"
  | "timeRange"
  | "duration"
  | "volume"
  | "angle"
  | "risk"
  | "reward"
  | "riskReward"
  | "riskPercent"
  | "rewardPercent"
  | "accountSize"
  | "lotSize"
  | "riskAmount"
  | "entry"
  | "profit"
  | "loss"
  | "lossPercent"
  | "profitPercent"
  | "leverage"
  | "margin";

/**
 * Horizontal placement of a drawing stats box.
 */
export type DrawingStatsPosition = "auto" | "left" | "center" | "right";

/**
 * Style for one Fibonacci level.
 */
export interface DrawingFibLevel {
  ratio: number;
  visible?: boolean;
  color?: DrawingColor | null;
  lineWidth?: number;
  lineStyle?: DrawingLineStyle;
  labelVisible?: boolean;
  labelColor?: DrawingColor | null;
}

/**
 * Drawing style and state options.
 */
export interface DrawingOptions {
  color?: DrawingColor | null;
  lineWidth?: number;
  lineStyle?: DrawingLineStyle;
  /** Line opacity from 0 to 1. Defaults to 1. */
  lineOpacity?: number;
  fillColor?: DrawingColor | null;
  fillOpacity?: number;
  /** Show shape fill. Defaults to true. */
  fillVisible?: boolean;
  showLabels?: boolean;
  /** Draw the drawing's line geometry. Defaults to true. */
  showLine?: boolean;
  /** Extend a drawing beyond all four anchor edges. */
  extend?: boolean;
  /** Extend beyond the first/left edge. */
  extendLeft?: boolean;
  /** Extend beyond the second/right edge. */
  extendRight?: boolean;
  /** Extend beyond the top price edge. */
  extendTop?: boolean;
  /** Extend beyond the bottom price edge. */
  extendBottom?: boolean;
  /** Draw a small dot at the midpoint of a trend line. */
  showMidpoint?: boolean;
  /** Show trend-line endpoint prices on the price axis. Defaults to never. */
  priceLabels?: DrawingPriceLabelsMode;
  /** Show trend-line endpoint times on the time axis. Defaults to never. */
  timeLabels?: DrawingTimeLabelsMode;
  /** Stop/loss colour for position drawings. */
  stopColor?: DrawingColor | null;
  /** Win/target colour for position drawings. */
  targetColor?: DrawingColor | null;
  /** Show a stats box. Defaults to off. */
  stats?: DrawingStatsMode;
  /**
   * Fields shown in the stats box, in display order. Omit to keep the built-in set:
   * range, change, bars, date, and angle where available.
   */
  statsFields?: readonly DrawingStatsField[];
  /** Stats box horizontal placement. Defaults to auto. */
  statsPosition?: DrawingStatsPosition;
  /** Colour for the drawing text. Defaults to the drawing colour. */
  textColor?: DrawingColor | null;
  /** Optional label text colour. Defaults to automatic contrast. */
  labelTextColor?: DrawingColor | null;
  /** Top channel/band line colour. */
  topLineColor?: DrawingColor | null;
  topLineWidth?: number;
  topLineStyle?: DrawingLineStyle;
  /** Middle channel/band line colour. */
  middleLineColor?: DrawingColor | null;
  middleLineWidth?: number;
  middleLineStyle?: DrawingLineStyle;
  middleLineVisible?: boolean;
  /** Bottom channel/band line colour. */
  bottomLineColor?: DrawingColor | null;
  bottomLineWidth?: number;
  bottomLineStyle?: DrawingLineStyle;
  /** Show channel/regression background fill. */
  channelBackgroundVisible?: boolean;
  /** Text drawing font family. */
  fontFamily?: string;
  /** Text drawing background colour. */
  backgroundColor?: DrawingColor | null;
  backgroundOpacity?: number;
  /** Text drawing border. */
  borderColor?: DrawingColor | null;
  borderWidth?: number;
  borderRadius?: number;
  /** Text drawing padding in CSS pixels. */
  padding?: number;
  /** Per-level Fibonacci settings. */
  fibLevels?: readonly DrawingFibLevel[];
  /** Show Fibonacci background fill. */
  fibBackgroundVisible?: boolean;
  /** Account size used by position drawings. */
  accountSize?: number;
  /** Risk percentage used by position drawings. */
  riskPercent?: number;
  /** Leverage used by position drawings for margin calculations. */
  leverage?: number;
  /** Contract size multiplier used by position drawings. */
  contractSize?: number;
  /** Position stats shown in the stop, entry, and profit boxes. */
  positionStatsFields?: readonly DrawingStatsField[];
  /** Font style for trend-line text. Defaults to normal. */
  textStyle?: DrawingTextStyle;
  /**
   * Horizontal placement for trend-line text. Left/right place it outside the start/end
   * anchor; center places it at the midpoint. Defaults to center.
   */
  textAlign?: DrawingTextAlign;
  /** Vertical alignment for trend-line text. Defaults to middle. */
  textVerticalAlign?: DrawingTextVerticalAlign;
  /** Text content for text drawings. */
  text?: string;
  /** Custom label sequence for drawing tools that render one label per anchor. */
  labels?: readonly string[];
  /** Label placement relative to its anchor. Defaults to `auto`. */
  labelPlacement?: DrawingLabelPlacement;
  /** Label font size in CSS pixels. Defaults to the chart layout font size. */
  labelFontSize?: number;
  /** Draw a background behind labels. Defaults to true. */
  labelBackgroundVisible?: boolean;
  /** Text size in CSS pixels for text drawings. */
  fontSize?: number;
  locked?: boolean;
  visible?: boolean;
}

/**
 * A drawing tool token.
 */
export interface DrawingToolDefinition {
  readonly id: string;
  readonly meta: ExtensionMeta;
  /** Number of anchors required to create the drawing. */
  readonly anchors: 1 | 2 | 3 | 4 | 5 | 6;
  /** How anchors are collected. Defaults to discrete clicks. */
  readonly capture?: "anchors" | "freehand" | "path" | "position";
  readonly defaultOptions?: DrawingOptions;
  /** False for transient tools such as measure. Defaults to true. */
  readonly persist?: boolean;
}

/**
 * Options for adding a drawing programmatically.
 */
export interface AddDrawingOptions {
  /** Defaults to the main pane. */
  paneId?: string;
  anchors: readonly DrawingAnchor[];
  options?: DrawingOptions;
}

/**
 * How `selectDrawing` changes the current selection.
 */
export type DrawingSelectionMode = "replace" | "add" | "toggle";

/**
 * Options for changing drawing selection.
 */
export interface SelectDrawingOptions {
  /** Defaults to replace. */
  mode?: DrawingSelectionMode;
}

/**
 * A live drawing annotation.
 */
export interface DrawingApi {
  readonly id: string;
  readonly toolId: string;
  readonly paneId: string;
  getAnchors(): readonly DrawingAnchor[];
  getOptions(): DrawingOptions;
  setAnchors(anchors: readonly DrawingAnchor[]): void;
  setOptions(options: Partial<DrawingOptions>): void;
  remove(): void;
}

/**
 * Serialized drawing.
 */
export interface SerializedDrawing {
  id: string;
  toolId: string;
  paneId: string;
  anchors: DrawingAnchor[];
  options: DrawingOptions;
}

/**
 * Versioned drawing document owned and persisted by the host.
 */
export interface DrawingDocument {
  version: 1;
  drawings: SerializedDrawing[];
}

/**
 * Plot geometry passed to a chart overlay.
 */
export interface OverlayPlotRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * Per-draw frame passed to a chart overlay.
 */
export interface OverlayRenderFrame {
  paneId: string;
  plot: OverlayPlotRect;
  visibleRange: VisibleRange;
  timeToX(time: Time): number | null;
  priceToY(price: number): number;
  yToPrice(y: number): number;
}

/**
 * Custom drawing contributed by an extension.
 */
export interface ChartOverlay {
  readonly id: string;
  /** Pane to draw in. Defaults to the main pane. */
  readonly paneId?: string;
  draw(context: CanvasRenderingContext2D, frame: OverlayRenderFrame): void;
}

/**
 * A live chart overlay.
 */
export interface ChartOverlayApi {
  readonly id: string;
  readonly paneId: string;
  requestRender(): void;
  remove(): void;
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
  source: "chart" | "series" | "extension" | "datafeed" | "indicator" | "drawing";
  /** Present when the error came from a series datafeed. */
  seriesId?: string;
  /** Present when the error came from an indicator. */
  indicatorId?: string;
  /** Present when the error came from a drawing. */
  drawingId?: string;
}

/**
 * Payload for the `data-loading` event.
 */
export interface DataLoadingEvent {
  seriesId: string;
  loading: boolean;
}

/**
 * Map of chart events to their payloads.
 */
export interface ChartEventMap {
  ready: ReadyEvent;
  crosshair: CrosshairEvent;
  "visible-range": VisibleRangeEvent;
  "data-loading": DataLoadingEvent;
  "drawing-created": { drawing: DrawingApi };
  "drawing-selected": { drawing: DrawingApi | null };
  "drawing-selection": { drawings: readonly DrawingApi[] };
  "drawing-updated": { drawing: DrawingApi };
  "drawing-double-click": { drawing: DrawingApi; point: Point };
  "drawing-removed": { drawingId: string };
  "drawing-cancelled": { toolId: string };
  click: ChartClickEvent;
  error: ChartErrorEvent;
}

/**
 * Returned by {@link ChartApi.on}. Idempotent and safe after `destroy()`.
 */
export type Unsubscribe = () => void;

/**
 * A recurring weekly trading session. Times are local to the calendar timezone.
 */
export interface SessionWindow {
  /** ISO weekday: 1 = Monday, 7 = Sunday. */
  openDay: number;
  /** Local open time in HH:mm form. */
  openTime: string;
  /** ISO weekday of the close. May be later than `openDay`. */
  closeDay: number;
  /** Local close time in HH:mm form. */
  closeTime: string;
}

/**
 * Host-supplied trading calendar.
 */
export interface TradingCalendar {
  /** IANA time zone, for example America/New_York. */
  timezone: string;
  /** Recurring weekly session windows. */
  sessions: readonly SessionWindow[];
  /** Closed local dates in YYYY-MM-DD form. */
  holidays?: readonly string[];
}

/**
 * How closed sessions are represented on the time axis.
 */
export type SessionGapMode = "compress" | "show";

/**
 * Time scale controls.
 */
export interface TimeScaleApi {
  getVisibleRange(): VisibleRange;
  setVisibleRange(range: VisibleRange): void;
  fitContent(): void;
  scrollToTime(time: Time): void;
  setOptions(options: Partial<TimeScaleOptions>): void;
  /** Read-only copy of the resolved time scale options. */
  getOptions(): Readonly<TimeScaleOptions>;
}

/**
 * Price scale controls.
 */
export interface PriceScaleApi {
  getVisibleRange(): PriceRange;
  setVisibleRange(range: PriceRange): void;
  setAutoScale(enabled: boolean): void;
  /** True while the scale follows the visible data. */
  isAutoScale(): boolean;
  /** Applies a partial price scale option update. */
  setOptions(options: Partial<PriceScaleOptions>): void;
  /** Read-only copy of the resolved price scale options. */
  getOptions(): Readonly<PriceScaleOptions>;
}

/**
 * A pane. Implemented in Phase 3.
 */
export interface PaneApi {
  readonly id: string;
  /** Preferred height in CSS pixels, or null when the pane shares remaining space. */
  getHeight(): number | null;
  /** Read-only copy of the pane's current options. */
  getOptions(): Readonly<PaneOptions>;
  getPriceScale(): PriceScaleApi;
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
  readonly typeId: string;
  readonly paneId: string;
  /** Read-only copy of the resolved series options. */
  getOptions(): Readonly<TOptions>;
  /** Current datafeed identity, or null when the series uses manual data. */
  getDatafeedOptions(): Readonly<SeriesDatafeedOptions> | null;
  /** Newest data point, even when it is outside the visible time range. */
  lastValue(): SeriesValueInfo | null;
  /** Last value at the visible right edge. */
  visibleLastValue(): SeriesValueInfo | null;
  setData(data: readonly TData[]): void;
  update(data: TData): void;
  setOptions(options: Partial<TOptions>): void;
  /** Replaces manual data with a datafeed and starts loading. */
  setDatafeed(feed: Datafeed<TData>, options: SeriesDatafeedOptions): void;
  /** Stops requests and subscriptions. Keeps loaded data. */
  clearDatafeed(): void;
  /** True while initial or range loads are in flight. */
  isLoading(): boolean;
  /** Adds a horizontal price line to this series. */
  createPriceLine(options: PriceLineOptions): PriceLineApi;
  /** Replaces all markers on this series. Pass an empty array to clear them. */
  setMarkers(markers: readonly SeriesMarker[]): void;
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
  /** All panes in layout order. The returned array is a copy. */
  getPanes(): readonly PaneApi[];
  addPane(options?: PaneOptions): PaneApi;
  addIndicator<TInputs extends IndicatorInputs>(
    definition: IndicatorDefinition<TInputs>,
    options?: AddIndicatorOptions<TInputs>,
  ): IndicatorApi<TInputs>;
  addDrawing(tool: DrawingToolDefinition, options: AddDrawingOptions): DrawingApi;
  addOverlay(overlay: ChartOverlay): ChartOverlayApi;
  startDrawing(tool: DrawingToolDefinition, options?: Partial<AddDrawingOptions>): void;
  cancelDrawing(): void;
  selectedDrawing(): DrawingApi | null;
  selectedDrawings(): readonly DrawingApi[];
  selectDrawing(id: string | null, options?: SelectDrawingOptions): void;
  selectNextDrawing(options?: SelectDrawingOptions): void;
  selectPreviousDrawing(options?: SelectDrawingOptions): void;
  selectAllDrawings(): void;
  /** Applies a partial style update to every selected drawing. */
  updateSelectedDrawings(options: Partial<DrawingOptions>): void;
  /** Sets per-chart defaults applied to newly created drawings of a tool. */
  setDrawingDefaults(toolId: string, options: Partial<DrawingOptions>): void;
  /** Returns the effective defaults for a tool, including built-in defaults. */
  drawingDefaults(toolId: string): DrawingOptions;
  serializeDrawings(): DrawingDocument;
  loadDrawings(document: DrawingDocument): void;
  /** Fits the time scale and restores auto-scale on every pane. */
  resetView(): void;
  timeScale(): TimeScaleApi;
  setOptions(options: Partial<ChartOptions>): void;
  on<K extends keyof ChartEventMap>(
    event: K,
    handler: (payload: ChartEventMap[K]) => void,
  ): Unsubscribe;
  resize(): void;
  /** Composites the current chart into a new canvas at backing-store resolution. */
  takeScreenshot(): HTMLCanvasElement;
  /** Composites the chart and returns a data URL. */
  exportImage(type?: string, quality?: number): string;
  destroy(): void;
}

/**
 * Features that can be licensed.
 */
export type Feature = "orderflow" | "volume-profile" | "strategy" | "alerts" | "script-functions";

/**
 * Runtime license context exposed to commercial extensions.
 */
export interface LicenseContext {
  hasFeature(feature: Feature): boolean;
}
