import type {
  DrawingAnchor,
  DrawingLineStyle,
  DrawingOptions,
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

const DEFAULTS: DrawingOptions = {
  color: "#2962ff",
  lineWidth: 1,
  lineStyle: "solid",
  fillOpacity: 0.12,
  showLabels: true,
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
  anchors: 5,
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
  anchors: 3,
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
  anchors: 5,
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
  anchors: 3,
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
  anchors: 5,
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
    HorizontalLine,
    HorizontalRay,
    VerticalLine,
    CrossLine,
    ParallelChannel,
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
    Measure,
  ].map((tool) => [tool.id, tool]),
);

export function resolveDrawingOptions(
  defaultOptions: DrawingOptions | undefined,
  options: DrawingOptions | undefined,
): ResolvedDrawingOptions {
  const merged: DrawingOptions = { ...DEFAULTS, ...defaultOptions, ...options };
  const fillColor = merged.fillColor ?? merged.color ?? "#2962ff";

  return {
    color: merged.color ?? "#2962ff",
    lineWidth: merged.lineWidth ?? 1,
    lineStyle: merged.lineStyle ?? "solid",
    fillColor,
    fillOpacity: merged.fillOpacity ?? 0.12,
    showLabels: merged.showLabels ?? true,
    locked: merged.locked ?? false,
    visible: merged.visible ?? true,
  };
}

export function mergeDrawingOptions(
  base: ResolvedDrawingOptions,
  patch: DrawingOptions,
): ResolvedDrawingOptions {
  return {
    color: patch.color ?? base.color,
    lineWidth: patch.lineWidth ?? base.lineWidth,
    lineStyle: patch.lineStyle ?? base.lineStyle,
    fillColor: patch.fillColor ?? base.fillColor,
    fillOpacity: patch.fillOpacity ?? base.fillOpacity,
    showLabels: patch.showLabels ?? base.showLabels,
    locked: patch.locked ?? base.locked,
    visible: patch.visible ?? base.visible,
  };
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
    case "trend-line":
    case "parallel-channel": {
      if (points.length < 2) {
        return false;
      }
      if (target.toolId === "parallel-channel" && points.length >= 3) {
        const channel = parallelLines(points, pane.plot);
        return (
          distanceToLine(point, channel[0][0], channel[0][1]) <= tolerance ||
          distanceToLine(point, channel[1][0], channel[1][1]) <= tolerance ||
          pointInChannel(point, channel, tolerance)
        );
      }
      return distanceToLine(point, points[0]!, points[1]!) <= tolerance;
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
    case "elliott-triple-combo": {
      return distanceToPolyline(point, points) <= tolerance;
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

export function parallelLines(
  points: readonly Point[],
  plot: { left: number; right: number; top: number; bottom: number },
): [[Point, Point], [Point, Point]] {
  const first = points[0]!;
  const second = points[1]!;
  const third = points[2]!;
  const dx = second.x - first.x;

  if (Math.abs(dx) < 0.0001) {
    return [
      [
        { x: first.x, y: plot.top },
        { x: first.x, y: plot.bottom },
      ],
      [
        { x: third.x, y: plot.top },
        { x: third.x, y: plot.bottom },
      ],
    ];
  }

  const slope = (second.y - first.y) / dx;
  const baseAt = (x: number): number => first.y + slope * (x - first.x);
  const offset = third.y - baseAt(third.x);
  return [
    [
      { x: plot.left, y: baseAt(plot.left) },
      { x: plot.right, y: baseAt(plot.right) },
    ],
    [
      { x: plot.left, y: baseAt(plot.left) + offset },
      { x: plot.right, y: baseAt(plot.right) + offset },
    ],
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
