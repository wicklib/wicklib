import { fail } from "./errors";
import type {
  DrawingAnchor,
  DrawingLineStyle,
  DrawingOptions,
  DrawingSetting,
  DrawingToolDefinition,
  Point,
} from "./types";
import { VERSION } from "./version";

export interface ResolvedDrawingOptions {
  color: string;
  lineWidth: number;
  lineStyle: DrawingLineStyle;
  fillColor: string;
  fillOpacity: number;
  showLabels: boolean;
  text: string;
  labels?: readonly string[];
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
  "locked",
  "visible",
]);
const LABEL_SETTINGS: readonly DrawingSetting[] = Object.freeze([
  "color",
  "lineWidth",
  "lineStyle",
  "showLabels",
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
  "labelFontSize",
  "labelBackgroundVisible",
  "locked",
  "visible",
]);
const TEXT_SETTINGS: readonly DrawingSetting[] = Object.freeze([
  "color",
  "text",
  "fontSize",
  "locked",
  "visible",
]);

const TOOL_SETTINGS: Readonly<Record<string, readonly DrawingSetting[]>> = Object.freeze({
  "trend-line": STROKE_SETTINGS,
  ray: STROKE_SETTINGS,
  "extended-line": STROKE_SETTINGS,
  "trend-angle": LABEL_SETTINGS,
  arrow: STROKE_SETTINGS,
  "horizontal-line": STROKE_SETTINGS,
  "horizontal-ray": STROKE_SETTINGS,
  "vertical-line": STROKE_SETTINGS,
  "cross-line": STROKE_SETTINGS,
  "parallel-channel": FILL_SETTINGS,
  "regression-trend": FILL_SETTINGS,
  "flat-top-bottom": FILL_SETTINGS,
  "disjoint-channel": FILL_SETTINGS,
  "fib-channel": LABEL_FILL_SETTINGS,
  "fib-time-zone": LABEL_SETTINGS,
  pitchfork: STROKE_SETTINGS,
  "schiff-pitchfork": STROKE_SETTINGS,
  "modified-schiff-pitchfork": STROKE_SETTINGS,
  "gann-fan": LABEL_SETTINGS,
  "speed-lines": STROKE_SETTINGS,
  rectangle: FILL_SETTINGS,
  "fib-retracement": LABEL_SETTINGS,
  "fib-extension": LABEL_SETTINGS,
  "long-short-position": LONG_SHORT_SETTINGS,
  "price-date-range": LABEL_FILL_SETTINGS,
  circle: FILL_SETTINGS,
  "elliott-impulse": LABEL_SETTINGS,
  "elliott-correction": LABEL_SETTINGS,
  "elliott-triangle": LABEL_SETTINGS,
  "elliott-double-combo": LABEL_SETTINGS,
  "elliott-triple-combo": LABEL_SETTINGS,
  brush: STROKE_SETTINGS,
  highlighter: STROKE_SETTINGS,
  path: STROKE_SETTINGS,
  text: TEXT_SETTINGS,
  measure: LABEL_SETTINGS,
  "stats-line": LABEL_SETTINGS,
});

const DEFAULTS: DrawingOptions = {
  color: "#2962ff",
  lineWidth: 1,
  lineStyle: "solid",
  fillOpacity: 0.12,
  showLabels: true,
  text: "",
  labelBackgroundVisible: true,
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
  defaultOptions: { color: "#f0b90b" },
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
  defaultOptions: { color: "#787b86" },
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
  defaultOptions: { color: "#787b86" },
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

export const PriceDateRange: DrawingToolDefinition = Object.freeze({
  id: "price-date-range",
  meta: {
    id: "com.wicklib.price-date-range",
    name: "Price/Date Range",
    version: VERSION,
    license: "free" as const,
  },
  anchors: 2,
  defaultOptions: { fillOpacity: 0.1 },
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
  const fillColor = merged.fillColor ?? merged.color ?? "#2962ff";
  const resolved: ResolvedDrawingOptions = {
    color: merged.color ?? "#2962ff",
    lineWidth: merged.lineWidth ?? 1,
    lineStyle: merged.lineStyle ?? "solid",
    fillColor,
    fillOpacity: merged.fillOpacity ?? 0.12,
    showLabels: merged.showLabels ?? true,
    text: merged.text ?? "",
    labelBackgroundVisible: merged.labelBackgroundVisible ?? true,
    fontSize: merged.fontSize ?? 13,
    locked: merged.locked ?? false,
    visible: merged.visible ?? true,
  };
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
    color: patch.color ?? base.color,
    lineWidth: patch.lineWidth ?? base.lineWidth,
    lineStyle: patch.lineStyle ?? base.lineStyle,
    fillColor: patch.fillColor ?? base.fillColor,
    fillOpacity: patch.fillOpacity ?? base.fillOpacity,
    showLabels: patch.showLabels ?? base.showLabels,
    text: patch.text ?? base.text,
    labelBackgroundVisible: patch.labelBackgroundVisible ?? base.labelBackgroundVisible,
    fontSize: patch.fontSize ?? base.fontSize,
    locked: patch.locked ?? base.locked,
    visible: patch.visible ?? base.visible,
  };
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
          pointInChannel(point, channel, tolerance)
        );
      }
      return distanceToLine(point, points[0]!, points[1]!) <= tolerance;
    }
    case "regression-trend": {
      if (points.length < 2) {
        return false;
      }
      return distanceToLine(point, points[0]!, points[1]!) <= tolerance;
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
        distanceToLine(point, channel[1][0], channel[1][1]) <= tolerance ||
        pointInChannel(point, channel, tolerance)
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
      if (geometry.right > geometry.left) {
        const polygon = [
          pointOnLine(geometry.first, geometry.left),
          pointOnLine(geometry.first, geometry.right),
          pointOnLine(geometry.second, geometry.right),
          pointOnLine(geometry.second, geometry.left),
        ];
        if (
          pointInPolygon(point, polygon) ||
          polygon.some((candidate, index) => {
            const next = polygon[(index + 1) % polygon.length]!;
            return distanceToSegment(point, candidate, next) <= tolerance;
          })
        ) {
          return true;
        }
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
        distanceToLine(point, channel[1][0], channel[1][1]) <= tolerance ||
        pointInChannel(point, channel, tolerance)
      );
    }
    case "rectangle":
    case "price-date-range": {
      if (points.length < 2) {
        return false;
      }
      return pointInRect(point, points[0]!, points[1]!, tolerance);
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
      return FIB_LEVELS.some((level) => {
        const y = points[0]!.y + (points[1]!.y - points[0]!.y) * level;
        return Math.abs(point.y - y) <= tolerance;
      });
    }
    case "fib-extension": {
      if (points.length < 3) {
        return false;
      }
      const delta = points[1]!.y - points[0]!.y;
      return FIB_EXTENSION_LEVELS.some(
        (level) => Math.abs(point.y - (points[2]!.y + delta * level)) <= tolerance,
      );
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
      const width = Math.max(20, target.options.text.length * target.options.fontSize * 0.6);
      return (
        point.x >= anchor.x - tolerance &&
        point.x <= anchor.x + width + tolerance &&
        point.y >= anchor.y - target.options.fontSize - tolerance &&
        point.y <= anchor.y + tolerance
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

function pointInChannel(
  point: Point,
  lines: [[Point, Point], [Point, Point]],
  tolerance: number,
): boolean {
  const polygon = [lines[0][0], lines[0][1], lines[1][1], lines[1][0]];
  if (pointInPolygon(point, polygon)) {
    return true;
  }
  return polygon.some((candidate, index) => {
    const next = polygon[(index + 1) % polygon.length]!;
    return distanceToSegment(point, candidate, next) <= tolerance;
  });
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

function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const current = polygon[index]!;
    const prior = polygon[previous]!;
    const intersects =
      current.y > point.y !== prior.y > point.y &&
      point.x < ((prior.x - current.x) * (point.y - current.y)) / (prior.y - current.y) + current.x;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}
