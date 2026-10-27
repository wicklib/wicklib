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
  [TrendLine, HorizontalLine, Rectangle, FibRetracement, Measure].map((tool) => [tool.id, tool]),
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
    case "trend-line": {
      if (points.length < 2) {
        return false;
      }
      return distanceToLine(point, points[0]!, points[1]!) <= tolerance;
    }
    case "rectangle": {
      if (points.length < 2) {
        return false;
      }
      return pointInRect(point, points[0]!, points[1]!, tolerance);
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
