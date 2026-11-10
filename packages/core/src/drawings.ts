import { fail } from "./errors";
import type {
  DrawingAnchor,
  DrawingColor,
  DrawingFibLevel,
  DrawingLabelPlacement,
  DrawingLineStyle,
  DrawingOptions,
  DrawingPriceLabelsMode,
  DrawingSetting,
  DrawingStatsField,
  DrawingStatsMode,
  DrawingStatsPosition,
  DrawingTextAlign,
  DrawingTextStyle,
  DrawingTextVerticalAlign,
  DrawingTimeLabelsMode,
  DrawingToolDefinition,
  Point,
} from "./types";
import { VERSION } from "./version";

export interface ResolvedDrawingOptions {
  color: DrawingColor;
  lineWidth: number;
  lineStyle: DrawingLineStyle;
  lineOpacity: number;
  fillColor: DrawingColor;
  fillOpacity: number;
  fillVisible: boolean;
  showLabels: boolean;
  showLine: boolean;
  extendLeft: boolean;
  extendRight: boolean;
  showMidpoint: boolean;
  priceLabels: DrawingPriceLabelsMode;
  timeLabels: DrawingTimeLabelsMode;
  stopColor: DrawingColor;
  targetColor: DrawingColor;
  extend: boolean;
  extendTop: boolean;
  extendBottom: boolean;
  labelTextColor?: DrawingColor;
  topLineColor: DrawingColor;
  topLineWidth: number;
  topLineStyle: DrawingLineStyle;
  middleLineColor: DrawingColor;
  middleLineWidth: number;
  middleLineStyle: DrawingLineStyle;
  middleLineVisible: boolean;
  bottomLineColor: DrawingColor;
  bottomLineWidth: number;
  bottomLineStyle: DrawingLineStyle;
  channelBackgroundVisible: boolean;
  fontFamily: string;
  backgroundColor?: DrawingColor;
  backgroundOpacity: number;
  borderColor?: DrawingColor;
  borderWidth: number;
  borderRadius: number;
  padding: number;
  fibLevels?: readonly DrawingFibLevel[];
  fibBackgroundVisible: boolean;
  accountSize: number;
  riskPercent: number;
  leverage: number;
  contractSize: number;
  positionStatsFields: readonly DrawingStatsField[];
  stats: DrawingStatsMode;
  statsFields: readonly DrawingStatsField[];
  statsPosition: DrawingStatsPosition;
  text: string;
  textColor: DrawingColor;
  textStyle: DrawingTextStyle;
  textAlign: DrawingTextAlign;
  textVerticalAlign: DrawingTextVerticalAlign;
  labels?: readonly string[];
  labelPlacement: DrawingLabelPlacement;
  labelFontSize?: number;
  labelBackgroundVisible: boolean;
  fontSize: number;
  locked: boolean;
  visible: boolean;
}

export interface DrawingGeometryPane {
  plot: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  priceScale: {
    priceToY(price: number, top: number, height: number): number;
    yToPrice(y: number, top: number, height: number): number;
  };
}

export interface DrawingGeometryTimeScale {
  timeToX(time: number): number | null;
  timeAtX(x: number): number | null;
}

export interface HitTestTarget {
  toolId: string;
  anchors: readonly DrawingAnchor[];
  options: ResolvedDrawingOptions;
}

const STROKE_SETTINGS: readonly DrawingSetting[] = Object.freeze([
  "color",
  "lineWidth",
  "lineStyle",
  "lineOpacity",
  "locked",
  "visible",
]);
const FREEHAND_SETTINGS: readonly DrawingSetting[] = Object.freeze([
  "color",
  "lineWidth",
  "lineOpacity",
  "locked",
  "visible",
]);
const LABEL_SETTINGS: readonly DrawingSetting[] = Object.freeze([
  "color",
  "lineWidth",
  "lineStyle",
  "showLabels",
  "labelPlacement",
  "labelFontSize",
  "labelBackgroundVisible",
  "locked",
  "visible",
]);
const FILL_SETTINGS: readonly DrawingSetting[] = Object.freeze([
  "color",
  "lineWidth",
  "lineStyle",
  "fillColor",
  "fillOpacity",
  "locked",
  "visible",
]);
const LABEL_FILL_SETTINGS: readonly DrawingSetting[] = Object.freeze([
  "color",
  "lineWidth",
  "lineStyle",
  "fillColor",
  "fillOpacity",
  "showLabels",
  "labelPlacement",
  "labelFontSize",
  "labelBackgroundVisible",
  "locked",
  "visible",
]);
const LONG_SHORT_SETTINGS: readonly DrawingSetting[] = Object.freeze([
  "color",
  "lineWidth",
  "lineStyle",
  "fillOpacity",
  "showLabels",
  "labelPlacement",
  "labelFontSize",
  "labelBackgroundVisible",
  "locked",
  "visible",
]);
const POSITION_SETTINGS: readonly DrawingSetting[] = Object.freeze([
  "lineWidth",
  "lineStyle",
  "fillOpacity",
  "priceLabels",
  "statsPosition",
  "stopColor",
  "targetColor",
  "labelTextColor",
  "labelFontSize",
  "accountSize",
  "riskPercent",
  "leverage",
  "contractSize",
  "positionStatsFields",
  "locked",
  "visible",
]);
const RANGE_SETTINGS: readonly DrawingSetting[] = Object.freeze([
  "color",
  "lineWidth",
  "lineStyle",
  "fillColor",
  "fillOpacity",
  "showLine",
  "extend",
  "extendTop",
  "extendBottom",
  "extendLeft",
  "extendRight",
  "labelTextColor",
  "labelFontSize",
  "stats",
  "statsFields",
  "statsPosition",
  "locked",
  "visible",
]);
const CHANNEL_SETTINGS: readonly DrawingSetting[] = Object.freeze([
  "topLineColor",
  "topLineWidth",
  "topLineStyle",
  "middleLineColor",
  "middleLineWidth",
  "middleLineStyle",
  "middleLineVisible",
  "bottomLineColor",
  "bottomLineWidth",
  "bottomLineStyle",
  "channelBackgroundVisible",
  "fillColor",
  "fillOpacity",
  "extendLeft",
  "extendRight",
  "locked",
  "visible",
]);
const AXIS_LINE_SETTINGS: readonly DrawingSetting[] = Object.freeze([
  "color",
  "lineWidth",
  "lineStyle",
  "showLine",
  "text",
  "textColor",
  "textStyle",
  "textAlign",
  "textVerticalAlign",
  "fontSize",
  "priceLabels",
  "timeLabels",
  "locked",
  "visible",
]);
const RECTANGLE_SETTINGS: readonly DrawingSetting[] = Object.freeze([
  "color",
  "lineWidth",
  "lineStyle",
  "fillColor",
  "fillOpacity",
  "fillVisible",
  "showLine",
  "extendLeft",
  "extendRight",
  "middleLineVisible",
  "middleLineColor",
  "middleLineWidth",
  "middleLineStyle",
  "text",
  "textColor",
  "textStyle",
  "textAlign",
  "textVerticalAlign",
  "fontSize",
  "locked",
  "visible",
]);
const TEXT_SETTINGS: readonly DrawingSetting[] = Object.freeze([
  "color",
  "text",
  "fontFamily",
  "fontSize",
  "textStyle",
  "textAlign",
  "textVerticalAlign",
  "backgroundColor",
  "backgroundOpacity",
  "borderColor",
  "borderWidth",
  "borderRadius",
  "padding",
  "locked",
  "visible",
]);
const FIB_SETTINGS: readonly DrawingSetting[] = Object.freeze([
  "color",
  "lineWidth",
  "lineStyle",
  "showLabels",
  "labelPlacement",
  "labelFontSize",
  "labelBackgroundVisible",
  "fibLevels",
  "fibBackgroundVisible",
  "fillColor",
  "fillOpacity",
  "extendLeft",
  "extendRight",
  "locked",
  "visible",
]);

const TREND_SETTINGS: readonly DrawingSetting[] = Object.freeze([
  ...STROKE_SETTINGS,
  "showLine",
  "extendLeft",
  "extendRight",
  "showMidpoint",
  "priceLabels",
  "timeLabels",
  "text",
  "textColor",
  "textStyle",
  "textAlign",
  "textVerticalAlign",
  "fontSize",
  "stats",
  "statsFields",
  "statsPosition",
]);
const ELLIOTT_SETTINGS: readonly DrawingSetting[] = Object.freeze([
  ...LABEL_SETTINGS,
  "showLine",
  "stats",
  "statsFields",
  "statsPosition",
]);

const TOOL_SETTINGS: Readonly<Record<string, readonly DrawingSetting[]>> = Object.freeze({
  "trend-line": TREND_SETTINGS,
  ray: STROKE_SETTINGS,
  "extended-line": STROKE_SETTINGS,
  "trend-angle": LABEL_SETTINGS,
  arrow: STROKE_SETTINGS,
  "horizontal-line": AXIS_LINE_SETTINGS,
  "horizontal-ray": STROKE_SETTINGS,
  "vertical-line": AXIS_LINE_SETTINGS,
  "cross-line": AXIS_LINE_SETTINGS,
  "parallel-channel": CHANNEL_SETTINGS,
  "regression-trend": CHANNEL_SETTINGS,
  "flat-top-bottom": FILL_SETTINGS,
  "disjoint-channel": FILL_SETTINGS,
  "fib-channel": LABEL_FILL_SETTINGS,
  "fib-time-zone": LABEL_SETTINGS,
  pitchfork: STROKE_SETTINGS,
  "schiff-pitchfork": STROKE_SETTINGS,
  "modified-schiff-pitchfork": STROKE_SETTINGS,
  "gann-fan": LABEL_SETTINGS,
  "speed-lines": STROKE_SETTINGS,
  rectangle: RECTANGLE_SETTINGS,
  "fib-retracement": FIB_SETTINGS,
  "fib-extension": FIB_SETTINGS,
  "long-short-position": LONG_SHORT_SETTINGS,
  "long-position": POSITION_SETTINGS,
  "short-position": POSITION_SETTINGS,
  "price-range": RANGE_SETTINGS,
  "time-range": RANGE_SETTINGS,
  "price-date-range": RANGE_SETTINGS,
  circle: FILL_SETTINGS,
  "elliott-impulse": ELLIOTT_SETTINGS,
  "elliott-correction": ELLIOTT_SETTINGS,
  "elliott-triangle": ELLIOTT_SETTINGS,
  "elliott-double-combo": ELLIOTT_SETTINGS,
  "elliott-triple-combo": ELLIOTT_SETTINGS,
  brush: FREEHAND_SETTINGS,
  highlighter: FREEHAND_SETTINGS,
  path: FREEHAND_SETTINGS,
  text: TEXT_SETTINGS,
  measure: [],
  "stats-line": LABEL_SETTINGS,
});

const DEFAULT_STATS_FIELDS: readonly DrawingStatsField[] = Object.freeze([
  "range",
  "change",
  "bars",
  "date",
  "angle",
]);

const DEFAULT_POSITION_STATS_FIELDS: readonly DrawingStatsField[] = Object.freeze([
  "loss",
  "lossPercent",
  "riskAmount",
  "entry",
  "profit",
  "riskReward",
]);

const DEFAULTS: DrawingOptions = {
  color: "#2962ff",
  lineWidth: 1,
  lineStyle: "solid",
  lineOpacity: 1,
  fillOpacity: 0.12,
  fillVisible: true,
  showLabels: true,
  showLine: true,
  extendLeft: false,
  extendRight: false,
  showMidpoint: false,
  priceLabels: "never",
  timeLabels: "never",
  stopColor: "#ef5350",
  targetColor: "#26a69a",
  extend: false,
  extendTop: false,
  extendBottom: false,
  accountSize: 10_000,
  riskPercent: 1,
  leverage: 1,
  contractSize: 1,
  positionStatsFields: DEFAULT_POSITION_STATS_FIELDS,
  stats: "off",
  statsFields: DEFAULT_STATS_FIELDS,
  statsPosition: "auto",
  text: "",
  textStyle: "normal",
  textAlign: "center",
  textVerticalAlign: "middle",
  labelPlacement: "auto",
  labelBackgroundVisible: true,
  middleLineVisible: true,
  channelBackgroundVisible: false,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  backgroundOpacity: 1,
  borderWidth: 0,
  borderRadius: 0,
  padding: 4,
  fibBackgroundVisible: false,
  fontSize: 13,
  locked: false,
  visible: true,
};

export const TrendLine: DrawingToolDefinition = Object.freeze({
  id: "trend-line",
  meta: {
    id: "com.wicklib.trend-line",
    name: "Trend Line",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
});

export const Ray: DrawingToolDefinition = Object.freeze({
  id: "ray",
  meta: {
    id: "com.wicklib.ray",
    name: "Ray",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
});

export const ExtendedLine: DrawingToolDefinition = Object.freeze({
  id: "extended-line",
  meta: {
    id: "com.wicklib.extended-line",
    name: "Extended Line",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
});

export const TrendAngle: DrawingToolDefinition = Object.freeze({
  id: "trend-angle",
  meta: {
    id: "com.wicklib.trend-angle",
    name: "Trend Angle",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
  defaultOptions: { showLabels: true },
});

export const Arrow: DrawingToolDefinition = Object.freeze({
  id: "arrow",
  meta: {
    id: "com.wicklib.arrow",
    name: "Arrow",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
});

export const HorizontalLine: DrawingToolDefinition = Object.freeze({
  id: "horizontal-line",
  meta: {
    id: "com.wicklib.horizontal-line",
    name: "Horizontal Line",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 1,
  defaultOptions: {
    color: "#787b86",
    priceLabels: "selected" as const,
  },
});

export const HorizontalRay: DrawingToolDefinition = Object.freeze({
  id: "horizontal-ray",
  meta: {
    id: "com.wicklib.horizontal-ray",
    name: "Horizontal Ray",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 1,
  defaultOptions: { color: "#f0b90b" },
});

export const VerticalLine: DrawingToolDefinition = Object.freeze({
  id: "vertical-line",
  meta: {
    id: "com.wicklib.vertical-line",
    name: "Vertical Line",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 1,
  defaultOptions: {
    color: "#787b86",
    timeLabels: "selected" as const,
  },
});

export const CrossLine: DrawingToolDefinition = Object.freeze({
  id: "cross-line",
  meta: {
    id: "com.wicklib.cross-line",
    name: "Cross Line",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 1,
  defaultOptions: {
    color: "#787b86",
    priceLabels: "selected" as const,
    timeLabels: "selected" as const,
  },
});

export const ParallelChannel: DrawingToolDefinition = Object.freeze({
  id: "parallel-channel",
  meta: {
    id: "com.wicklib.parallel-channel",
    name: "Parallel Channel",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 3,
  defaultOptions: { fillOpacity: 0.1 },
});

export const RegressionTrend: DrawingToolDefinition = Object.freeze({
  id: "regression-trend",
  meta: {
    id: "com.wicklib.regression-trend",
    name: "Regression Trend",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
  defaultOptions: { fillOpacity: 0.08 },
});

export const FlatTopBottom: DrawingToolDefinition = Object.freeze({
  id: "flat-top-bottom",
  meta: {
    id: "com.wicklib.flat-top-bottom",
    name: "Flat Top/Bottom",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 3,
  defaultOptions: { fillOpacity: 0.1 },
});

export const DisjointChannel: DrawingToolDefinition = Object.freeze({
  id: "disjoint-channel",
  meta: {
    id: "com.wicklib.disjoint-channel",
    name: "Disjoint Channel",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 4,
  defaultOptions: { fillOpacity: 0.1 },
});

export const FibChannel: DrawingToolDefinition = Object.freeze({
  id: "fib-channel",
  meta: {
    id: "com.wicklib.fib-channel",
    name: "Fib Channel",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 3,
  defaultOptions: { fillOpacity: 0.08, showLabels: true },
});

export const FibTimeZone: DrawingToolDefinition = Object.freeze({
  id: "fib-time-zone",
  meta: {
    id: "com.wicklib.fib-time-zone",
    name: "Fib Time Zone",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
  defaultOptions: { showLabels: true },
});

export const Pitchfork: DrawingToolDefinition = Object.freeze({
  id: "pitchfork",
  meta: {
    id: "com.wicklib.pitchfork",
    name: "Pitchfork",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 3,
});

export const SchiffPitchfork: DrawingToolDefinition = Object.freeze({
  id: "schiff-pitchfork",
  meta: {
    id: "com.wicklib.schiff-pitchfork",
    name: "Schiff Pitchfork",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 3,
});

export const ModifiedSchiffPitchfork: DrawingToolDefinition = Object.freeze({
  id: "modified-schiff-pitchfork",
  meta: {
    id: "com.wicklib.modified-schiff-pitchfork",
    name: "Modified Schiff Pitchfork",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 3,
});

export const GannFan: DrawingToolDefinition = Object.freeze({
  id: "gann-fan",
  meta: {
    id: "com.wicklib.gann-fan",
    name: "Gann Fan",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
  defaultOptions: { showLabels: true },
});

export const SpeedLines: DrawingToolDefinition = Object.freeze({
  id: "speed-lines",
  meta: {
    id: "com.wicklib.speed-lines",
    name: "Speed Lines",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 3,
});

export const FibExtension: DrawingToolDefinition = Object.freeze({
  id: "fib-extension",
  meta: {
    id: "com.wicklib.fib-extension",
    name: "Fib Extension",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 3,
  defaultOptions: { color: "#787b86" },
});

export const LongShortPosition: DrawingToolDefinition = Object.freeze({
  id: "long-short-position",
  meta: {
    id: "com.wicklib.long-short-position",
    name: "Long/Short Position",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 3,
  defaultOptions: { showLabels: true },
});

export const LongPosition: DrawingToolDefinition = Object.freeze({
  id: "long-position",
  meta: {
    id: "com.wicklib.long-position",
    name: "Long Position",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 4,
  capture: "position",
  defaultOptions: {
    stopColor: "#ef5350",
    targetColor: "#26a69a",
    fillOpacity: 0.16,
    priceLabels: "always" as const,
    labelTextColor: "#ffffff",
    labelFontSize: 12,
    accountSize: 10_000,
    riskPercent: 1,
    leverage: 1,
    contractSize: 1,
    positionStatsFields: [
      "loss",
      "lossPercent",
      "riskAmount",
      "entry",
      "profit",
      "riskReward",
    ] as const,
    statsPosition: "center" as const,
  },
});

export const ShortPosition: DrawingToolDefinition = Object.freeze({
  id: "short-position",
  meta: {
    id: "com.wicklib.short-position",
    name: "Short Position",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 4,
  capture: "position",
  defaultOptions: {
    stopColor: "#ef5350",
    targetColor: "#26a69a",
    fillOpacity: 0.16,
    priceLabels: "always" as const,
    labelTextColor: "#ffffff",
    labelFontSize: 12,
    accountSize: 10_000,
    riskPercent: 1,
    leverage: 1,
    contractSize: 1,
    positionStatsFields: [
      "loss",
      "lossPercent",
      "riskAmount",
      "entry",
      "profit",
      "riskReward",
    ] as const,
    statsPosition: "center" as const,
  },
});

export const PriceRangeDrawing: DrawingToolDefinition = Object.freeze({
  id: "price-range",
  meta: {
    id: "com.wicklib.price-range",
    name: "Price Range",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
  defaultOptions: {
    fillOpacity: 0.1,
    extendLeft: true,
    extendRight: true,
    stats: "always" as const,
    statsFields: ["range", "bars", "timeRange", "volume"] as const,
  },
});

export const TimeRangeDrawing: DrawingToolDefinition = Object.freeze({
  id: "time-range",
  meta: {
    id: "com.wicklib.time-range",
    name: "Time Range",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
  defaultOptions: {
    fillOpacity: 0.1,
    extendTop: true,
    extendBottom: true,
    stats: "always" as const,
    statsFields: ["bars", "timeRange", "volume"] as const,
  },
});

export const PriceDateRange: DrawingToolDefinition = Object.freeze({
  id: "price-date-range",
  meta: {
    id: "com.wicklib.price-date-range",
    name: "Date and Price Range",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
  defaultOptions: {
    fillOpacity: 0.1,
    stats: "always" as const,
    statsFields: ["range", "bars", "timeRange", "volume"] as const,
  },
});

export const Circle: DrawingToolDefinition = Object.freeze({
  id: "circle",
  meta: {
    id: "com.wicklib.circle",
    name: "Circle",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
  defaultOptions: { fillOpacity: 0.1 },
});

export const ElliottImpulse: DrawingToolDefinition = Object.freeze({
  id: "elliott-impulse",
  meta: {
    id: "com.wicklib.elliott-impulse",
    name: "Elliott Impulse Wave",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 6,
  defaultOptions: { color: "#2962ff" },
});

export const ElliottCorrection: DrawingToolDefinition = Object.freeze({
  id: "elliott-correction",
  meta: {
    id: "com.wicklib.elliott-correction",
    name: "Elliott Correction Wave",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 4,
  defaultOptions: { color: "#2962ff" },
});

export const ElliottTriangle: DrawingToolDefinition = Object.freeze({
  id: "elliott-triangle",
  meta: {
    id: "com.wicklib.elliott-triangle",
    name: "Elliott Triangle",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 6,
  defaultOptions: { color: "#2962ff" },
});

export const ElliottDoubleCombo: DrawingToolDefinition = Object.freeze({
  id: "elliott-double-combo",
  meta: {
    id: "com.wicklib.elliott-double-combo",
    name: "Elliott Double Combo",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 4,
  defaultOptions: { color: "#2962ff" },
});

export const ElliottTripleCombo: DrawingToolDefinition = Object.freeze({
  id: "elliott-triple-combo",
  meta: {
    id: "com.wicklib.elliott-triple-combo",
    name: "Elliott Triple Combo",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 6,
  defaultOptions: { color: "#2962ff" },
});

export const Rectangle: DrawingToolDefinition = Object.freeze({
  id: "rectangle",
  meta: {
    id: "com.wicklib.rectangle",
    name: "Rectangle",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
  defaultOptions: { fillOpacity: 0.12 },
});

export const FibRetracement: DrawingToolDefinition = Object.freeze({
  id: "fib-retracement",
  meta: {
    id: "com.wicklib.fib-retracement",
    name: "Fib Retracement",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
  defaultOptions: { color: "#787b86" },
});

export const Brush: DrawingToolDefinition = Object.freeze({
  id: "brush",
  meta: {
    id: "com.wicklib.brush",
    name: "Brush",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
  capture: "freehand",
  defaultOptions: { color: "#2962ff", lineWidth: 2 },
});

export const Highlighter: DrawingToolDefinition = Object.freeze({
  id: "highlighter",
  meta: {
    id: "com.wicklib.highlighter",
    name: "Highlighter",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
  capture: "freehand",
  defaultOptions: { color: "rgba(255,235,59,0.35)", lineWidth: 14 },
});

export const Path: DrawingToolDefinition = Object.freeze({
  id: "path",
  meta: {
    id: "com.wicklib.path",
    name: "Path",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
  capture: "path",
  defaultOptions: { color: "#2962ff", lineWidth: 2 },
});

export const Text: DrawingToolDefinition = Object.freeze({
  id: "text",
  meta: {
    id: "com.wicklib.text",
    name: "Text",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 1,
  defaultOptions: { text: "Text", showLabels: true },
});

export const StatsLine: DrawingToolDefinition = Object.freeze({
  id: "stats-line",
  meta: {
    id: "com.wicklib.stats-line",
    name: "Stats Line",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
  defaultOptions: { showLabels: true },
});

export const Measure: DrawingToolDefinition = Object.freeze({
  id: "measure",
  meta: {
    id: "com.wicklib.measure",
    name: "Measure",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
  persist: false,
  defaultOptions: { showLabels: true },
});

export const DRAWING_TOOLS: ReadonlyMap<string, DrawingToolDefinition> = new Map(
  [
    TrendLine,
    Ray,
    ExtendedLine,
    TrendAngle,
    Arrow,
    HorizontalLine,
    HorizontalRay,
    VerticalLine,
    CrossLine,
    ParallelChannel,
    RegressionTrend,
    FlatTopBottom,
    DisjointChannel,
    FibChannel,
    FibTimeZone,
    Pitchfork,
    SchiffPitchfork,
    ModifiedSchiffPitchfork,
    GannFan,
    SpeedLines,
    Rectangle,
    FibRetracement,
    FibExtension,
    LongShortPosition,
    LongPosition,
    ShortPosition,
    PriceRangeDrawing,
    TimeRangeDrawing,
    PriceDateRange,
    Circle,
    ElliottImpulse,
    ElliottCorrection,
    ElliottTriangle,
    ElliottDoubleCombo,
    ElliottTripleCombo,
    Brush,
    Highlighter,
    Path,
    Text,
    Measure,
    StatsLine,
  ].map((tool) => [tool.id, tool]),
);

/**
 * Returns the settings a host should expose for a drawing tool.
 */
/**
 * Stable grouping for host menus.
 */
export type DrawingToolCategory =
  | "lines"
  | "channels"
  | "fibonacci"
  | "shapes"
  | "positions"
  | "ranges"
  | "patterns"
  | "freehand"
  | "text"
  | "measurement";

const TOOL_CATEGORIES: Readonly<Record<string, DrawingToolCategory>> = Object.freeze({
  "trend-line": "lines",
  ray: "lines",
  "extended-line": "lines",
  "trend-angle": "lines",
  arrow: "lines",
  "horizontal-line": "lines",
  "horizontal-ray": "lines",
  "vertical-line": "lines",
  "cross-line": "lines",
  "parallel-channel": "channels",
  "regression-trend": "channels",
  "flat-top-bottom": "channels",
  "disjoint-channel": "channels",
  "fib-channel": "channels",
  "fib-time-zone": "fibonacci",
  pitchfork: "channels",
  "schiff-pitchfork": "channels",
  "modified-schiff-pitchfork": "channels",
  "gann-fan": "lines",
  "speed-lines": "lines",
  "fib-retracement": "fibonacci",
  "fib-extension": "fibonacci",
  rectangle: "shapes",
  circle: "shapes",
  "long-short-position": "positions",
  "long-position": "positions",
  "short-position": "positions",
  "price-range": "ranges",
  "time-range": "ranges",
  "price-date-range": "ranges",
  "elliott-impulse": "patterns",
  "elliott-correction": "patterns",
  "elliott-triangle": "patterns",
  "elliott-double-combo": "patterns",
  "elliott-triple-combo": "patterns",
  brush: "freehand",
  highlighter: "freehand",
  path: "freehand",
  text: "text",
  measure: "measurement",
  "stats-line": "measurement",
});

/**
 * One entry in the built-in drawing-tool catalog.
 */
export interface DrawingToolCatalogEntry {
  readonly definition: DrawingToolDefinition;
  readonly category: DrawingToolCategory;
  readonly settings: readonly DrawingSetting[];
}

/**
 * Built-in drawing tools in menu order. Hosts own labels, icons, localization, and layout.
 */
export const DRAWING_TOOL_CATALOG: readonly DrawingToolCatalogEntry[] = Object.freeze(
  [...DRAWING_TOOLS.values()].map((definition) =>
    Object.freeze({
      definition,
      category: TOOL_CATEGORIES[definition.id] ?? "lines",
      settings: drawingToolSettings(definition.id),
    }),
  ),
);

export function drawingToolSettings(toolId: string): readonly DrawingSetting[] {
  if (!DRAWING_TOOLS.has(toolId)) {
    throw new Error(`Unknown drawing tool: ${toolId}`);
  }
  return TOOL_SETTINGS[toolId] ?? STROKE_SETTINGS;
}

export function resolveDrawingOptions(
  defaultOptions: DrawingOptions | undefined,
  options: DrawingOptions | undefined,
): ResolvedDrawingOptions {
  const merged: DrawingOptions = { ...DEFAULTS, ...defaultOptions, ...options };
  const color = normalizeDrawingColor(merged.color, "#2962ff");
  const fillColor = normalizeDrawingColor(merged.fillColor, color);
  const textColor = normalizeDrawingColor(merged.textColor, color);
  const stopColor = normalizeDrawingColor(merged.stopColor, "#ef5350");
  const targetColor = normalizeDrawingColor(merged.targetColor, "#26a69a");
  const labelTextColor = normalizeOptionalDrawingColor(merged.labelTextColor, textColor);
  const topLineColor = normalizeDrawingColor(merged.topLineColor, color);
  const middleLineColor = normalizeDrawingColor(merged.middleLineColor, color);
  const bottomLineColor = normalizeDrawingColor(merged.bottomLineColor, color);
  const backgroundColor = normalizeOptionalDrawingColor(merged.backgroundColor, color);
  const borderColor = normalizeOptionalDrawingColor(merged.borderColor, color);
  const fibLevels = normalizedFibLevels(merged.fibLevels, color);
  const accountSize = normalizedPositiveNumber(merged.accountSize, 10_000, "accountSize");
  const riskPercent = normalizedRiskPercent(merged.riskPercent);
  const leverage = normalizedPositiveNumber(merged.leverage, 1, "leverage");
  const contractSize = normalizedPositiveNumber(merged.contractSize, 1, "contractSize");
  const resolved: ResolvedDrawingOptions = {
    color,
    lineWidth: merged.lineWidth ?? 1,
    lineStyle: merged.lineStyle ?? "solid",
    lineOpacity: normalizedLineOpacity(merged.lineOpacity),
    fillColor,
    fillOpacity: merged.fillOpacity ?? 0.12,
    fillVisible: merged.fillVisible ?? true,
    showLabels: merged.showLabels ?? true,
    showLine: merged.showLine ?? true,
    extend: merged.extend ?? false,
    extendLeft: merged.extendLeft ?? false,
    extendRight: merged.extendRight ?? false,
    extendTop: merged.extendTop ?? false,
    extendBottom: merged.extendBottom ?? false,
    showMidpoint: merged.showMidpoint ?? false,
    priceLabels: normalizedPriceLabels(merged.priceLabels),
    timeLabels: normalizedPriceLabels(merged.timeLabels),
    stopColor,
    targetColor,
    topLineColor,
    topLineWidth: normalizedPositiveNumber(
      merged.topLineWidth,
      merged.lineWidth ?? 1,
      "topLineWidth",
    ),
    topLineStyle: merged.topLineStyle ?? merged.lineStyle ?? "solid",
    middleLineColor,
    middleLineWidth: normalizedPositiveNumber(
      merged.middleLineWidth,
      merged.lineWidth ?? 1,
      "middleLineWidth",
    ),
    middleLineStyle: merged.middleLineStyle ?? merged.lineStyle ?? "solid",
    middleLineVisible: merged.middleLineVisible ?? true,
    bottomLineColor,
    bottomLineWidth: normalizedPositiveNumber(
      merged.bottomLineWidth,
      merged.lineWidth ?? 1,
      "bottomLineWidth",
    ),
    bottomLineStyle: merged.bottomLineStyle ?? merged.lineStyle ?? "solid",
    channelBackgroundVisible: merged.channelBackgroundVisible ?? false,
    fontFamily:
      merged.fontFamily ?? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundOpacity: normalizedOpacity(merged.backgroundOpacity, "backgroundOpacity"),
    borderWidth: normalizedNonNegativeNumber(merged.borderWidth, 0, "borderWidth"),
    borderRadius: normalizedNonNegativeNumber(merged.borderRadius, 0, "borderRadius"),
    padding: normalizedNonNegativeNumber(merged.padding, 4, "padding"),
    fibBackgroundVisible: merged.fibBackgroundVisible ?? false,
    accountSize,
    riskPercent,
    leverage,
    contractSize,
    positionStatsFields: normalizedPositionStatsFields(merged.positionStatsFields),
    stats: normalizedStats(merged.stats),
    statsFields: normalizedStatsFields(merged.statsFields),
    statsPosition: normalizedStatsPosition(merged.statsPosition),
    text: merged.text ?? "",
    textColor,
    textStyle: normalizedTextStyle(merged.textStyle),
    textAlign: normalizedTextAlign(merged.textAlign),
    textVerticalAlign: normalizedTextVerticalAlign(merged.textVerticalAlign),
    labelPlacement: normalizedLabelPlacement(merged.labelPlacement),
    labelBackgroundVisible: merged.labelBackgroundVisible ?? true,
    fontSize: merged.fontSize ?? 13,
    locked: merged.locked ?? false,
    visible: merged.visible ?? true,
  };
  if (labelTextColor !== undefined) {
    resolved.labelTextColor = labelTextColor;
  }
  if (backgroundColor !== undefined) {
    resolved.backgroundColor = backgroundColor;
  }
  if (borderColor !== undefined) {
    resolved.borderColor = borderColor;
  }
  if (fibLevels !== undefined) {
    resolved.fibLevels = fibLevels;
  }
  if (merged.labels !== undefined) {
    resolved.labels = validateLabels(merged.labels);
  }
  if (merged.labelFontSize !== undefined) {
    resolved.labelFontSize = validateLabelFontSize(merged.labelFontSize);
  }
  return resolved;
}

export function mergeDrawingOptions(
  base: ResolvedDrawingOptions,
  patch: DrawingOptions,
): ResolvedDrawingOptions {
  const merged: ResolvedDrawingOptions = {
    color: mergeDrawingColor(patch.color, base.color),
    lineWidth: patch.lineWidth ?? base.lineWidth,
    lineStyle: patch.lineStyle ?? base.lineStyle,
    lineOpacity: patch.lineOpacity ?? base.lineOpacity,
    fillColor: mergeDrawingColor(patch.fillColor, base.fillColor),
    fillOpacity: patch.fillOpacity ?? base.fillOpacity,
    fillVisible: patch.fillVisible ?? base.fillVisible,
    showLabels: patch.showLabels ?? base.showLabels,
    showLine: patch.showLine ?? base.showLine,
    extend: patch.extend ?? base.extend,
    extendLeft: patch.extendLeft ?? base.extendLeft,
    extendRight: patch.extendRight ?? base.extendRight,
    extendTop: patch.extendTop ?? base.extendTop,
    extendBottom: patch.extendBottom ?? base.extendBottom,
    showMidpoint: patch.showMidpoint ?? base.showMidpoint,
    priceLabels: patch.priceLabels ?? base.priceLabels,
    timeLabels: patch.timeLabels ?? base.timeLabels,
    stopColor: mergeDrawingColor(patch.stopColor, base.stopColor),
    targetColor: mergeDrawingColor(patch.targetColor, base.targetColor),
    topLineColor: mergeDrawingColor(patch.topLineColor, base.topLineColor),
    topLineWidth: patch.topLineWidth ?? base.topLineWidth,
    topLineStyle: patch.topLineStyle ?? base.topLineStyle,
    middleLineColor: mergeDrawingColor(patch.middleLineColor, base.middleLineColor),
    middleLineWidth: patch.middleLineWidth ?? base.middleLineWidth,
    middleLineStyle: patch.middleLineStyle ?? base.middleLineStyle,
    middleLineVisible: patch.middleLineVisible ?? base.middleLineVisible,
    bottomLineColor: mergeDrawingColor(patch.bottomLineColor, base.bottomLineColor),
    bottomLineWidth: patch.bottomLineWidth ?? base.bottomLineWidth,
    bottomLineStyle: patch.bottomLineStyle ?? base.bottomLineStyle,
    channelBackgroundVisible: patch.channelBackgroundVisible ?? base.channelBackgroundVisible,
    fontFamily: patch.fontFamily ?? base.fontFamily,
    backgroundOpacity: patch.backgroundOpacity ?? base.backgroundOpacity,
    borderWidth: patch.borderWidth ?? base.borderWidth,
    borderRadius: patch.borderRadius ?? base.borderRadius,
    padding: patch.padding ?? base.padding,
    fibBackgroundVisible: patch.fibBackgroundVisible ?? base.fibBackgroundVisible,
    accountSize: patch.accountSize ?? base.accountSize,
    riskPercent: patch.riskPercent ?? base.riskPercent,
    leverage: patch.leverage ?? base.leverage,
    contractSize: patch.contractSize ?? base.contractSize,
    positionStatsFields:
      patch.positionStatsFields !== undefined
        ? normalizedPositionStatsFields(patch.positionStatsFields)
        : base.positionStatsFields,
    stats: patch.stats ?? base.stats,
    statsFields:
      patch.statsFields !== undefined ? normalizedStatsFields(patch.statsFields) : base.statsFields,
    statsPosition: patch.statsPosition ?? base.statsPosition,
    text: patch.text ?? base.text,
    textColor: mergeDrawingColor(patch.textColor, base.textColor),
    textStyle: patch.textStyle ?? base.textStyle,
    textAlign: patch.textAlign ?? base.textAlign,
    textVerticalAlign: patch.textVerticalAlign ?? base.textVerticalAlign,
    labelPlacement: patch.labelPlacement ?? base.labelPlacement,
    labelBackgroundVisible: patch.labelBackgroundVisible ?? base.labelBackgroundVisible,
    fontSize: patch.fontSize ?? base.fontSize,
    locked: patch.locked ?? base.locked,
    visible: patch.visible ?? base.visible,
  };
  if (patch.backgroundColor !== undefined) {
    const backgroundColor = normalizeOptionalDrawingColor(patch.backgroundColor, merged.textColor);
    if (backgroundColor !== undefined) {
      merged.backgroundColor = backgroundColor;
    } else {
      delete merged.backgroundColor;
    }
  } else if (base.backgroundColor !== undefined) {
    merged.backgroundColor = base.backgroundColor;
  }
  if (patch.borderColor !== undefined) {
    const borderColor = normalizeOptionalDrawingColor(patch.borderColor, merged.textColor);
    if (borderColor !== undefined) {
      merged.borderColor = borderColor;
    } else {
      delete merged.borderColor;
    }
  } else if (base.borderColor !== undefined) {
    merged.borderColor = base.borderColor;
  }
  if (patch.fibLevels !== undefined) {
    const fibLevels = normalizedFibLevels(patch.fibLevels, merged.color);
    if (fibLevels !== undefined) {
      merged.fibLevels = fibLevels;
    } else {
      delete merged.fibLevels;
    }
  } else if (base.fibLevels !== undefined) {
    merged.fibLevels = base.fibLevels;
  }
  if (patch.labelTextColor !== undefined) {
    const labelTextColor = normalizeOptionalDrawingColor(patch.labelTextColor, merged.textColor);
    if (labelTextColor !== undefined) {
      merged.labelTextColor = labelTextColor;
    } else {
      delete merged.labelTextColor;
    }
  } else if (base.labelTextColor !== undefined) {
    merged.labelTextColor = base.labelTextColor;
  }
  if (patch.labels !== undefined) {
    merged.labels = validateLabels(patch.labels);
  } else if (base.labels !== undefined) {
    merged.labels = base.labels;
  }
  if (patch.labelFontSize !== undefined) {
    merged.labelFontSize = validateLabelFontSize(patch.labelFontSize);
  } else if (base.labelFontSize !== undefined) {
    merged.labelFontSize = base.labelFontSize;
  }
  return merged;
}

function normalizeOptionalDrawingColor(
  value: DrawingColor | null | undefined,
  fallback: DrawingColor,
): DrawingColor | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return normalizeDrawingColor(value, fallback);
}

function normalizeDrawingColor(
  value: DrawingColor | null | undefined,
  fallback: DrawingColor,
): DrawingColor {
  if (value === undefined) {
    return fallback;
  }
  if (value === null || value === "" || value === "theme") {
    return "theme";
  }
  return value;
}

function mergeDrawingColor(
  value: DrawingColor | null | undefined,
  fallback: DrawingColor,
): DrawingColor {
  return value === undefined ? fallback : normalizeDrawingColor(value, fallback);
}

function normalizedPriceLabels(value: DrawingPriceLabelsMode | undefined): DrawingPriceLabelsMode {
  if (value === undefined || value === "never" || value === "selected" || value === "always") {
    return value ?? "never";
  }
  fail("INVALID_ARGUMENT", "priceLabels must be never, selected, or always");
}

function normalizedLineOpacity(value: number | undefined): number {
  if (value === undefined) {
    return 1;
  }
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    fail("INVALID_ARGUMENT", "lineOpacity must be between 0 and 1");
  }
  return value;
}

function normalizedStats(value: DrawingStatsMode | undefined): DrawingStatsMode {
  if (value === undefined || value === "off" || value === "selected" || value === "always") {
    return value ?? "off";
  }
  fail("INVALID_ARGUMENT", "stats must be off, selected, or always");
}

function normalizedStatsFields(
  value: readonly DrawingStatsField[] | undefined,
): readonly DrawingStatsField[] {
  if (value === undefined) {
    return DEFAULT_STATS_FIELDS;
  }
  if (!Array.isArray(value)) {
    fail("INVALID_ARGUMENT", "statsFields must be an array of stats fields");
  }
  const fields: DrawingStatsField[] = [];
  for (const field of value) {
    if (
      field !== "range" &&
      field !== "change" &&
      field !== "bars" &&
      field !== "date" &&
      field !== "timeRange" &&
      field !== "duration" &&
      field !== "volume" &&
      field !== "angle" &&
      field !== "risk" &&
      field !== "reward" &&
      field !== "riskReward" &&
      field !== "riskPercent" &&
      field !== "rewardPercent" &&
      field !== "lossPercent" &&
      field !== "accountSize" &&
      field !== "lotSize" &&
      field !== "riskAmount" &&
      field !== "entry" &&
      field !== "profit" &&
      field !== "loss" &&
      field !== "leverage" &&
      field !== "margin"
    ) {
      fail("INVALID_ARGUMENT", "statsFields contains an unsupported field");
    }
    if (!fields.includes(field)) {
      fields.push(field);
    }
  }
  return fields;
}

function normalizedNonNegativeNumber(
  value: number | undefined,
  fallback: number,
  name: string,
): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isFinite(value) || value < 0) {
    fail("INVALID_ARGUMENT", `${name} must be a non-negative number`);
  }
  return value;
}

function normalizedOpacity(value: number | undefined, name: string): number {
  return Math.min(1, normalizedNonNegativeNumber(value, 1, name));
}

function normalizedFibLevels(
  value: readonly DrawingFibLevel[] | undefined,
  fallbackColor: DrawingColor,
): readonly DrawingFibLevel[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    fail("INVALID_ARGUMENT", "fibLevels must be an array");
  }
  return value.map((level) => {
    if (!level || !Number.isFinite(level.ratio)) {
      fail("INVALID_ARGUMENT", "fibLevels entries require a finite ratio");
    }
    return {
      ratio: level.ratio,
      ...(level.visible !== undefined ? { visible: level.visible } : {}),
      ...(level.color !== undefined
        ? { color: normalizeDrawingColor(level.color, fallbackColor) }
        : {}),
      ...(level.lineWidth !== undefined
        ? { lineWidth: normalizedPositiveNumber(level.lineWidth, 1, "fibLevels.lineWidth") }
        : {}),
      ...(level.lineStyle !== undefined ? { lineStyle: level.lineStyle } : {}),
      ...(level.labelVisible !== undefined ? { labelVisible: level.labelVisible } : {}),
      ...(level.labelColor !== undefined
        ? { labelColor: normalizeDrawingColor(level.labelColor, fallbackColor) }
        : {}),
    };
  });
}

function normalizedPositiveNumber(
  value: number | undefined,
  fallback: number,
  name: string,
): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isFinite(value) || value <= 0) {
    fail("INVALID_ARGUMENT", `${name} must be a positive number`);
  }
  return value;
}

function normalizedRiskPercent(value: number | undefined): number {
  const riskPercent = normalizedPositiveNumber(value, 1, "riskPercent");
  if (riskPercent > 100) {
    fail("INVALID_ARGUMENT", "riskPercent must be between 0 and 100");
  }
  return riskPercent;
}

function normalizedPositionStatsFields(
  value: readonly DrawingStatsField[] | undefined,
): readonly DrawingStatsField[] {
  if (value === undefined) {
    return DEFAULT_POSITION_STATS_FIELDS;
  }
  if (!Array.isArray(value)) {
    fail("INVALID_ARGUMENT", "positionStatsFields must be an array");
  }
  const allowed: readonly DrawingStatsField[] = [
    "accountSize",
    "lotSize",
    "riskPercent",
    "riskAmount",
    "lossPercent",
    "riskReward",
    "entry",
    "profit",
    "loss",
    "leverage",
    "margin",
  ];
  const fields: DrawingStatsField[] = [];
  for (const field of value) {
    if (!allowed.includes(field)) {
      fail("INVALID_ARGUMENT", "positionStatsFields contains an unsupported field");
    }
    if (!fields.includes(field)) {
      fields.push(field);
    }
  }
  return fields;
}

function normalizedStatsPosition(value: DrawingStatsPosition | undefined): DrawingStatsPosition {
  if (
    value === undefined ||
    value === "auto" ||
    value === "left" ||
    value === "center" ||
    value === "right"
  ) {
    return value ?? "auto";
  }
  fail("INVALID_ARGUMENT", "statsPosition must be auto, left, center, or right");
}

function normalizedTextStyle(value: DrawingTextStyle | undefined): DrawingTextStyle {
  if (
    value === undefined ||
    value === "normal" ||
    value === "bold" ||
    value === "italic" ||
    value === "bold-italic"
  ) {
    return value ?? "normal";
  }
  fail("INVALID_ARGUMENT", "textStyle must be normal, bold, italic, or bold-italic");
}

function normalizedTextAlign(value: DrawingTextAlign | undefined): DrawingTextAlign {
  if (value === undefined || value === "left" || value === "center" || value === "right") {
    return value ?? "center";
  }
  fail("INVALID_ARGUMENT", "textAlign must be left, center, or right");
}

function normalizedTextVerticalAlign(
  value: DrawingTextVerticalAlign | undefined,
): DrawingTextVerticalAlign {
  if (value === undefined || value === "top" || value === "middle" || value === "bottom") {
    return value ?? "middle";
  }
  fail("INVALID_ARGUMENT", "textVerticalAlign must be top, middle, or bottom");
}

function normalizedLabelPlacement(value: DrawingLabelPlacement | undefined): DrawingLabelPlacement {
  if (value === undefined || value === "auto" || value === "above" || value === "below") {
    return value ?? "auto";
  }
  fail("INVALID_ARGUMENT", "labelPlacement must be auto, above, or below");
}

export function elliottLabelPlacement(
  points: readonly Point[],
  index: number,
  placement: DrawingLabelPlacement,
): "above" | "below" {
  if (placement === "above" || placement === "below") {
    return placement;
  }
  const current = points[index];
  if (!current) {
    return "above";
  }
  const neighbors = [points[index - 1], points[index + 1]].filter(
    (point): point is Point => point !== undefined,
  );
  if (neighbors.length === 0) {
    return "above";
  }
  const high = neighbors.every((point) => current.y <= point.y + 0.001);
  const low = neighbors.every((point) => current.y >= point.y - 0.001);
  if (high && low) {
    return "above";
  }
  if (high) {
    return "above";
  }
  if (low) {
    return "below";
  }
  const next = points[index + 1];
  return next !== undefined && next.y < current.y ? "below" : "above";
}

function validateLabelFontSize(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    fail("INVALID_ARGUMENT", "labelFontSize must be a positive finite number");
  }
  return value;
}

function validateLabels(labels: readonly string[]): readonly string[] {
  if (!Array.isArray(labels) || labels.some((label) => typeof label !== "string")) {
    fail("INVALID_ARGUMENT", "drawing labels must be an array of strings");
  }
  return [...labels];
}

export function anchorPoint(
  anchor: DrawingAnchor,
  pane: DrawingGeometryPane,
  timeScale: DrawingGeometryTimeScale,
): Point | null {
  const x = timeScale.timeToX(anchor.time);
  if (x === null) {
    return null;
  }
  return {
    x,
    y: pane.priceScale.priceToY(anchor.price, pane.plot.top, pane.plot.height),
  };
}

export function anchorPoints(
  anchors: readonly DrawingAnchor[],
  pane: DrawingGeometryPane,
  timeScale: DrawingGeometryTimeScale,
): Array<Point | null> {
  return anchors.map((anchor) => anchorPoint(anchor, pane, timeScale));
}

export function hitTestDrawing(
  target: HitTestTarget,
  point: Point,
  pane: DrawingGeometryPane,
  timeScale: DrawingGeometryTimeScale,
  tolerance = 6,
): boolean {
  if (!target.options.visible) {
    return false;
  }

  const points = anchorPoints(target.anchors, pane, timeScale).filter(
    (candidate): candidate is Point => candidate !== null,
  );

  if (points.length === 0) {
    return false;
  }

  if (point.x < pane.plot.left || point.x > pane.plot.right) {
    return false;
  }

  switch (target.toolId) {
    case "horizontal-line": {
      return Math.abs(point.y - points[0]!.y) <= tolerance;
    }
    case "horizontal-ray": {
      return point.x >= points[0]!.x - tolerance && Math.abs(point.y - points[0]!.y) <= tolerance;
    }
    case "vertical-line": {
      return Math.abs(point.x - points[0]!.x) <= tolerance;
    }
    case "cross-line": {
      return (
        Math.abs(point.x - points[0]!.x) <= tolerance ||
        Math.abs(point.y - points[0]!.y) <= tolerance
      );
    }
    case "ray": {
      if (points.length < 2) {
        return false;
      }
      return distanceToRay(point, points[0]!, points[1]!) <= tolerance;
    }
    case "extended-line": {
      if (points.length < 2) {
        return false;
      }
      return distanceToLine(point, points[0]!, points[1]!) <= tolerance;
    }
    case "trend-line":
    case "trend-angle":
    case "arrow":
    case "parallel-channel": {
      if (points.length < 2) {
        return false;
      }
      if (target.toolId === "parallel-channel" && points.length >= 3) {
        const channel = parallelLines(points);
        return (
          distanceToLine(point, channel[0][0], channel[0][1]) <= tolerance ||
          distanceToLine(point, channel[1][0], channel[1][1]) <= tolerance ||
          (target.options.middleLineVisible &&
            distanceToLine(
              point,
              { x: channel[0][0].x, y: (channel[0][0].y + channel[1][0].y) / 2 },
              { x: channel[0][1].x, y: (channel[0][1].y + channel[1][1].y) / 2 },
            ) <= tolerance)
        );
      }
      return distanceToLine(point, points[0]!, points[1]!) <= tolerance;
    }
    case "regression-trend": {
      if (points.length < 2) {
        return false;
      }
      return pointInRect(point, points[0]!, points[1]!, tolerance);
    }
    case "fib-time-zone": {
      if (points.length < 2) {
        return false;
      }
      return fibTimeZoneValues(points).some((entry) => Math.abs(point.x - entry.x) <= tolerance);
    }
    case "pitchfork":
    case "schiff-pitchfork":
    case "modified-schiff-pitchfork": {
      if (points.length < 3) {
        return false;
      }
      const variant =
        target.toolId === "pitchfork"
          ? "andrews"
          : target.toolId === "schiff-pitchfork"
            ? "schiff"
            : "modified-schiff";
      return pitchforkLines(points, variant).some(
        (line) => distanceToLine(point, line[0], line[1]) <= tolerance,
      );
    }
    case "gann-fan": {
      if (points.length < 2) {
        return false;
      }
      return gannFanLines(points).some(
        (entry) => distanceToLine(point, entry.line[0], entry.line[1]) <= tolerance,
      );
    }
    case "speed-lines": {
      if (points.length < 3) {
        return false;
      }
      return speedLineLines(points).some(
        (line) => distanceToLine(point, line[0], line[1]) <= tolerance,
      );
    }
    case "flat-top-bottom": {
      if (points.length < 3) {
        return false;
      }
      const channel = flatChannelLines(points);
      return (
        distanceToLine(point, channel[0][0], channel[0][1]) <= tolerance ||
        distanceToLine(point, channel[1][0], channel[1][1]) <= tolerance
      );
    }
    case "disjoint-channel": {
      if (points.length < 4) {
        return false;
      }
      const geometry = disjointChannelGeometry(points);
      if (
        distanceToSegment(point, geometry.first[0], geometry.first[1]) <= tolerance ||
        distanceToSegment(point, geometry.second[0], geometry.second[1]) <= tolerance
      ) {
        return true;
      }
      return false;
    }
    case "fib-channel": {
      if (points.length < 3) {
        return false;
      }
      const channel = parallelLines(points);
      return (
        distanceToLine(point, channel[0][0], channel[0][1]) <= tolerance ||
        distanceToLine(point, channel[1][0], channel[1][1]) <= tolerance
      );
    }
    case "rectangle": {
      if (points.length < 2) {
        return false;
      }
      return pointInRect(point, points[0]!, points[1]!, tolerance);
    }
    case "price-range":
    case "time-range":
    case "price-date-range": {
      if (points.length < 2) {
        return false;
      }
      const plot = pane.plot;
      let left = Math.min(points[0]!.x, points[1]!.x);
      let right = Math.max(points[0]!.x, points[1]!.x);
      let top = Math.min(points[0]!.y, points[1]!.y);
      let bottom = Math.max(points[0]!.y, points[1]!.y);
      if (target.options.extend || target.options.extendLeft) {
        left = plot.left;
      }
      if (target.options.extend || target.options.extendRight) {
        right = plot.right;
      }
      if (target.options.extend || target.options.extendTop) {
        top = plot.top;
      }
      if (target.options.extend || target.options.extendBottom) {
        bottom = plot.bottom;
      }
      return (
        point.x >= left - tolerance &&
        point.x <= right + tolerance &&
        point.y >= top - tolerance &&
        point.y <= bottom + tolerance
      );
    }
    case "circle": {
      if (points.length < 2) {
        return false;
      }
      return pointInEllipse(point, points[0]!, points[1]!, tolerance);
    }
    case "fib-retracement": {
      if (points.length < 2) {
        return false;
      }
      const levels: readonly DrawingFibLevel[] =
        target.options.fibLevels ?? FIB_LEVELS.map((ratio): DrawingFibLevel => ({ ratio }));
      return levels.some((level) => {
        if (level.visible === false) {
          return false;
        }
        const y = points[0]!.y + (points[1]!.y - points[0]!.y) * level.ratio;
        return Math.abs(point.y - y) <= tolerance;
      });
    }
    case "fib-extension": {
      if (points.length < 3) {
        return false;
      }
      const delta = points[1]!.y - points[0]!.y;
      const levels: readonly DrawingFibLevel[] =
        target.options.fibLevels ??
        FIB_EXTENSION_LEVELS.map((ratio): DrawingFibLevel => ({ ratio }));
      return levels.some(
        (level) =>
          level.visible !== false &&
          Math.abs(point.y - (points[2]!.y + delta * level.ratio)) <= tolerance,
      );
    }
    case "long-position":
    case "short-position": {
      if (points.length < 4) {
        return false;
      }
      const left = Math.min(points[0]!.x, points[3]!.x);
      const right = Math.max(points[0]!.x, points[3]!.x);
      const entryY = points[0]!.y;
      const stopY = points[1]!.y;
      const targetY = points[2]!.y;
      const withinTime = point.x >= left - tolerance && point.x <= right + tolerance;
      const inStop =
        withinTime &&
        point.y >= Math.min(entryY, stopY) - tolerance &&
        point.y <= Math.max(entryY, stopY) + tolerance;
      const inTarget =
        withinTime &&
        point.y >= Math.min(entryY, targetY) - tolerance &&
        point.y <= Math.max(entryY, targetY) + tolerance;
      return inStop || inTarget;
    }
    case "long-short-position": {
      if (points.length < 3) {
        return false;
      }
      return (
        pointInRect(point, points[0]!, points[1]!, tolerance) ||
        pointInRect(point, points[0]!, points[2]!, tolerance)
      );
    }
    case "elliott-impulse":
    case "elliott-correction":
    case "elliott-triangle":
    case "elliott-double-combo":
    case "elliott-triple-combo":
    case "brush":
    case "highlighter":
    case "path": {
      return distanceToPolyline(point, points) <= tolerance;
    }
    case "text": {
      const anchor = points[0]!;
      const padding = target.options.padding;
      const width =
        Math.max(20, target.options.text.length * target.options.fontSize * 0.6) + padding * 2;
      const height = target.options.fontSize + padding * 2;
      const left =
        target.options.textAlign === "center"
          ? anchor.x - width / 2
          : target.options.textAlign === "right"
            ? anchor.x - width
            : anchor.x;
      const top =
        target.options.textVerticalAlign === "middle"
          ? anchor.y - height / 2
          : target.options.textVerticalAlign === "bottom"
            ? anchor.y - height
            : anchor.y;
      return (
        point.x >= left - tolerance &&
        point.x <= left + width + tolerance &&
        point.y >= top - tolerance &&
        point.y <= top + height + tolerance
      );
    }
    default: {
      if (points.length < 2) {
        return false;
      }
      return distanceToSegment(point, points[0]!, points[1]!) <= tolerance;
    }
  }
}

export function hitTestAnchor(
  target: HitTestTarget,
  point: Point,
  pane: DrawingGeometryPane,
  timeScale: DrawingGeometryTimeScale,
  radius = 8,
): number {
  if (!target.options.visible) {
    return -1;
  }
  const points = anchorPoints(target.anchors, pane, timeScale);

  if (target.toolId === "rectangle" && points[0] && points[1]) {
    const first = points[0];
    const second = points[1];
    const left = Math.min(first.x, second.x);
    const right = Math.max(first.x, second.x);
    const top = Math.min(first.y, second.y);
    const bottom = Math.max(first.y, second.y);
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    const handles = [
      { x: left, y: top },
      { x: centerX, y: top },
      { x: right, y: top },
      { x: right, y: centerY },
      { x: right, y: bottom },
      { x: centerX, y: bottom },
      { x: left, y: bottom },
      { x: left, y: centerY },
    ];
    for (let index = 0; index < handles.length; index += 1) {
      const candidate = handles[index]!;
      if (Math.hypot(candidate.x - point.x, candidate.y - point.y) <= radius) {
        return index;
      }
    }
    return -1;
  }

  for (let index = 0; index < points.length; index += 1) {
    const candidate = points[index];
    if (!candidate) {
      continue;
    }
    if (Math.hypot(candidate.x - point.x, candidate.y - point.y) <= radius) {
      return index;
    }
  }

  return -1;
}

export const FIB_LEVELS: readonly number[] = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

export const FIB_EXTENSION_LEVELS: readonly number[] = [
  0, 0.382, 0.618, 1, 1.618, 2.618, 3.618, 4.236,
];

export function clipLineToRect(
  first: Point,
  second: Point,
  rect: { left: number; top: number; right: number; bottom: number },
): [Point, Point] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const p = [-dx, dx, -dy, dy];
  const q = [first.x - rect.left, rect.right - first.x, first.y - rect.top, rect.bottom - first.y];

  for (let index = 0; index < 4; index += 1) {
    if (p[index] === 0) {
      if (q[index]! < 0) {
        return null;
      }
      continue;
    }

    const ratio = q[index]! / p[index]!;
    if (p[index]! < 0) {
      if (ratio > t1) {
        return null;
      }
      if (ratio > t0) {
        t0 = ratio;
      }
    } else {
      if (ratio < t0) {
        return null;
      }
      if (ratio < t1) {
        t1 = ratio;
      }
    }
  }

  return [
    { x: first.x + t0 * dx, y: first.y + t0 * dy },
    { x: first.x + t1 * dx, y: first.y + t1 * dy },
  ];
}

function distanceToPolyline(point: Point, points: readonly Point[]): number {
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length; index += 1) {
    distance = Math.min(distance, distanceToSegment(point, points[index - 1]!, points[index]!));
  }
  return distance;
}

function distanceToRay(point: Point, first: Point, second: Point): number {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - first.x, point.y - first.y);
  }
  const t = ((point.x - first.x) * dx + (point.y - first.y) * dy) / lengthSquared;
  if (t < 0) {
    return Math.hypot(point.x - first.x, point.y - first.y);
  }
  return distanceToLine(point, first, second);
}

function distanceToLine(point: Point, first: Point, second: Point): number {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return Math.hypot(point.x - first.x, point.y - first.y);
  }
  return Math.abs(dy * point.x - dx * point.y + second.x * first.y - second.y * first.x) / length;
}

function distanceToSegment(point: Point, first: Point, second: Point): number {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - first.x, point.y - first.y);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - first.x) * dx + (point.y - first.y) * dy) / lengthSquared),
  );

  return Math.hypot(point.x - (first.x + t * dx), point.y - (first.y + t * dy));
}

function pointInRect(point: Point, first: Point, second: Point, tolerance: number): boolean {
  const left = Math.min(first.x, second.x) - tolerance;
  const right = Math.max(first.x, second.x) + tolerance;
  const top = Math.min(first.y, second.y) - tolerance;
  const bottom = Math.max(first.y, second.y) + tolerance;
  return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
}

export function parallelLines(points: readonly Point[]): [[Point, Point], [Point, Point]] {
  const first = points[0]!;
  const second = points[1]!;
  const third = points[2]!;
  const left = Math.min(first.x, second.x);
  const right = Math.max(first.x, second.x);
  const dx = second.x - first.x;

  if (Math.abs(dx) < 0.0001) {
    return [
      [
        { x: first.x, y: first.y },
        { x: first.x, y: third.y },
      ],
      [
        { x: third.x, y: first.y },
        { x: third.x, y: third.y },
      ],
    ];
  }

  const slope = (second.y - first.y) / dx;
  const baseAt = (x: number): number => first.y + slope * (x - first.x);
  const offset = third.y - baseAt(third.x);
  return [
    [
      { x: left, y: baseAt(left) },
      { x: right, y: baseAt(right) },
    ],
    [
      { x: left, y: baseAt(left) + offset },
      { x: right, y: baseAt(right) + offset },
    ],
  ];
}

export function flatChannelLines(points: readonly Point[]): [[Point, Point], [Point, Point]] {
  const first = points[0]!;
  const second = points[1]!;
  const third = points[2]!;
  const left = Math.min(first.x, second.x);
  const right = Math.max(first.x, second.x);
  const dx = second.x - first.x;
  const slope = Math.abs(dx) < 0.0001 ? 0 : (second.y - first.y) / dx;
  const baseAt = (x: number): number => first.y + slope * (x - first.x);
  return [
    [
      { x: left, y: baseAt(left) },
      { x: right, y: baseAt(right) },
    ],
    [
      { x: left, y: third.y },
      { x: right, y: third.y },
    ],
  ];
}

export interface DisjointChannelGeometry {
  first: [Point, Point];
  second: [Point, Point];
  left: number;
  right: number;
}

export function disjointChannelGeometry(points: readonly Point[]): DisjointChannelGeometry {
  const first: [Point, Point] = [points[0]!, points[1]!];
  const second: [Point, Point] = [points[2]!, points[3]!];
  return {
    first,
    second,
    left: Math.max(Math.min(first[0].x, first[1].x), Math.min(second[0].x, second[1].x)),
    right: Math.min(Math.max(first[0].x, first[1].x), Math.max(second[0].x, second[1].x)),
  };
}

export function pointOnLine(line: [Point, Point], x: number): Point {
  const [first, second] = line;
  const dx = second.x - first.x;
  if (dx === 0) {
    return { x, y: first.y };
  }
  const ratio = (x - first.x) / dx;
  return { x, y: first.y + (second.y - first.y) * ratio };
}

export const FIB_TIME_RATIOS: readonly number[] = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

export function fibTimeZoneValues(points: readonly Point[]): Array<{ ratio: number; x: number }> {
  const first = points[0]!;
  const second = points[1]!;
  return FIB_TIME_RATIOS.map((ratio) => ({
    ratio,
    x: first.x + (second.x - first.x) * ratio,
  }));
}

export type PitchforkVariant = "andrews" | "schiff" | "modified-schiff";

export function pitchforkLines(
  points: readonly Point[],
  variant: PitchforkVariant,
): Array<[Point, Point]> {
  const first = points[0]!;
  const second = points[1]!;
  const third = points[2]!;
  const midpoint = { x: (second.x + third.x) / 2, y: (second.y + third.y) / 2 };
  let origin = first;
  if (variant === "schiff") {
    origin = { x: first.x, y: (first.y + second.y) / 2 };
  } else if (variant === "modified-schiff") {
    origin = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  }
  const dx = midpoint.x - origin.x;
  const dy = midpoint.y - origin.y;
  return [
    [origin, midpoint],
    [second, { x: second.x + dx, y: second.y + dy }],
    [third, { x: third.x + dx, y: third.y + dy }],
  ];
}

export function gannFanLines(
  points: readonly Point[],
): Array<{ ratio: number; label: string; line: [Point, Point] }> {
  const first = points[0]!;
  const second = points[1]!;
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  return [
    [1 / 8, "1x8"],
    [1 / 4, "1x4"],
    [1 / 3, "1x3"],
    [1 / 2, "1x2"],
    [1, "1x1"],
    [2, "2x1"],
    [3, "3x1"],
    [4, "4x1"],
    [8, "8x1"],
  ].map(([ratio, label]) => ({
    ratio: ratio as number,
    label: label as string,
    line: [first, { x: first.x + dx, y: first.y + dy * (ratio as number) }],
  }));
}

export function speedLineLines(points: readonly Point[]): Array<[Point, Point]> {
  const first = points[0]!;
  const second = points[1]!;
  const third = points[2]!;
  const thirdPoint = {
    x: second.x + (third.x - second.x) / 3,
    y: second.y + (third.y - second.y) / 3,
  };
  const twoThirdsPoint = {
    x: second.x + ((third.x - second.x) * 2) / 3,
    y: second.y + ((third.y - second.y) * 2) / 3,
  };
  return [
    [first, second],
    [first, thirdPoint],
    [first, twoThirdsPoint],
  ];
}

function pointInEllipse(point: Point, first: Point, second: Point, tolerance: number): boolean {
  const cx = (first.x + second.x) / 2;
  const cy = (first.y + second.y) / 2;
  const rx = Math.abs(second.x - first.x) / 2 + tolerance;
  const ry = Math.abs(second.y - first.y) / 2 + tolerance;
  if (rx === 0 || ry === 0) {
    return Math.hypot(point.x - cx, point.y - cy) <= tolerance;
  }
  return ((point.x - cx) / rx) ** 2 + ((point.y - cy) / ry) ** 2 <= 1;
}
