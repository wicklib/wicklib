import { fail } from "../errors";
import type { Time, TimeScaleOptions, VisibleRange } from "../types";

export interface TimeScaleSource {
  /** Number of bars available. */
  count(): number;
  /** Time at an index, or undefined when out of range. */
  timeAt(index: number): Time | undefined;
  /** Nearest index to a time. */
  nearestIndex(time: Time): number;
}

const DEFAULT_OPTIONS: Required<TimeScaleOptions> = {
  barSpacing: 8,
  rightOffset: 2,
  minBarSpacing: 0.001,
  maxBarSpacing: 200,
  timeVisible: true,
  secondsVisible: false,
};

interface IndexRange {
  first: number;
  last: number;
}

/**
 * Index-based continuous time scale.
 *
 * Bars are laid out on a uniform index axis, so missing timestamps never create gaps.
 * Time is used for labels and for the public visible range.
 */
export class TimeScale {
  private readonly source: TimeScaleSource;
  private width = 1;
  private barSpacing = DEFAULT_OPTIONS.barSpacing;
  private rightOffset = DEFAULT_OPTIONS.rightOffset;
  private minBarSpacing = DEFAULT_OPTIONS.minBarSpacing;
  private maxBarSpacing = DEFAULT_OPTIONS.maxBarSpacing;
  private timeVisible = DEFAULT_OPTIONS.timeVisible;
  private secondsVisible = DEFAULT_OPTIONS.secondsVisible;
  private explicitRange = false;

  constructor(source: TimeScaleSource, options: TimeScaleOptions = {}) {
    this.source = source;
    this.applyOptions(options);
    this.clamp();
  }

  getWidth(): number {
    return this.width;
  }

  setWidth(width: number): void {
    if (!Number.isFinite(width) || width <= 0) {
      return;
    }
    this.width = width;
    this.clamp();
  }

  getBarSpacing(): number {
    return this.barSpacing;
  }

  getRightOffset(): number {
    return this.rightOffset;
  }

  getOptions(): Required<TimeScaleOptions> {
    return {
      barSpacing: this.barSpacing,
      rightOffset: this.rightOffset,
      minBarSpacing: this.minBarSpacing,
      maxBarSpacing: this.maxBarSpacing,
      timeVisible: this.timeVisible,
      secondsVisible: this.secondsVisible,
    };
  }

  setOptions(options: TimeScaleOptions): void {
    this.applyOptions(options);
    this.clamp();
  }

  onDataChanged(): void {
    this.clamp();
  }

  indexToX(index: number): number {
    return this.width - (this.rightEdgeIndex() - index) * this.barSpacing;
  }

  xToIndex(x: number): number {
    return this.rightEdgeIndex() - (this.width - x) / this.barSpacing;
  }

  timeToX(time: Time): number | null {
    const index = this.source.nearestIndex(time);
    if (index < 0) {
      return null;
    }
    return this.indexToX(index);
  }

  timeAtX(x: number): Time | null {
    const count = this.source.count();
    if (count === 0) {
      return null;
    }
    const index = Math.round(this.xToIndex(x));
    if (index < 0 || index >= count) {
      return null;
    }
    return this.source.timeAt(index) ?? null;
  }

  visibleIndexRange(): IndexRange {
    const count = this.source.count();
    if (count === 0) {
      return { first: 0, last: -1 };
    }
    const first = Math.max(0, Math.floor(this.xToIndex(0)));
    const last = Math.min(count - 1, Math.ceil(this.xToIndex(this.width)));
    return { first, last };
  }

  getVisibleRange(): VisibleRange {
    const range = this.visibleIndexRange();
    if (range.last < range.first) {
      return { from: 0, to: 0 };
    }
    const from = this.source.timeAt(range.first) ?? 0;
    const to = this.source.timeAt(range.last) ?? from;
    return { from, to };
  }

  getVisibleSpan(): number {
    const range = this.getVisibleRange();
    return range.to - range.from;
  }

  /** True once the host or user has chosen a view explicitly. */
  hasExplicitRange(): boolean {
    return this.explicitRange;
  }

  /** True when the latest bar is at or near the right edge. */
  isAtRightEdge(tolerancePixels = 24): boolean {
    if (this.source.count() === 0) {
      return true;
    }
    return this.rightOffset >= -0.5 && this.rightOffset * this.barSpacing <= tolerancePixels;
  }

  pan(deltaX: number): void {
    if (!Number.isFinite(deltaX) || deltaX === 0) {
      return;
    }
    this.explicitRange = true;
    this.rightOffset -= deltaX / this.barSpacing;
    this.clamp();
  }

  zoomAt(anchorX: number, deltaY: number): void {
    if (!Number.isFinite(deltaY) || deltaY === 0) {
      return;
    }
    this.explicitRange = true;

    const factor = Math.exp(-deltaY * 0.0015);
    const nextSpacing = clamp(this.barSpacing * factor, this.minBarSpacing, this.maxBarSpacing);
    if (nextSpacing === this.barSpacing) {
      return;
    }

    const anchorIndex = this.xToIndex(anchorX);
    this.barSpacing = nextSpacing;
    this.rightOffset = anchorIndex + (this.width - anchorX) / this.barSpacing - this.lastIndex();
    this.clamp();
  }

  fitContent(paddingPixels = 8): void {
    this.explicitRange = true;
    const count = this.source.count();
    if (count === 0) {
      this.barSpacing = DEFAULT_OPTIONS.barSpacing;
      this.rightOffset = 0;
      return;
    }

    const usable = Math.max(1, this.width - paddingPixels * 2);
    this.barSpacing = clamp(
      usable / Math.max(1, count - 1),
      this.minBarSpacing,
      this.maxBarSpacing,
    );
    this.rightOffset = paddingPixels / this.barSpacing;
    this.clamp();
  }

  setVisibleRange(range: VisibleRange): void {
    if (!Number.isFinite(range.from) || !Number.isFinite(range.to) || range.to <= range.from) {
      fail("INVALID_ARGUMENT", "Visible range must have finite values with to > from");
    }

    this.explicitRange = true;

    const count = this.source.count();
    if (count === 0) {
      return;
    }

    let first = this.source.nearestIndex(range.from);
    let last = this.source.nearestIndex(range.to);

    if (first < 0 || last < 0) {
      return;
    }

    if (last <= first) {
      if (first >= count - 1) {
        first = Math.max(0, count - 2);
        last = count - 1;
      } else {
        last = first + 1;
      }
    }

    this.barSpacing = clamp(
      this.width / Math.max(1, last - first),
      this.minBarSpacing,
      this.maxBarSpacing,
    );
    this.rightOffset = last - this.lastIndex();
    this.clamp();
  }

  scrollToTime(time: Time): void {
    this.explicitRange = true;
    const index = this.source.nearestIndex(time);
    if (index < 0) {
      return;
    }

    const half = this.width / (2 * this.barSpacing);
    this.rightOffset = index + half - this.lastIndex();
    this.clamp();
  }

  private applyOptions(options: TimeScaleOptions): void {
    if (options.barSpacing !== undefined) {
      assertPositive("barSpacing", options.barSpacing);
      this.barSpacing = options.barSpacing;
    }
    if (options.rightOffset !== undefined) {
      if (!Number.isFinite(options.rightOffset)) {
        fail("INVALID_ARGUMENT", "rightOffset must be finite");
      }
      this.rightOffset = options.rightOffset;
    }
    if (options.minBarSpacing !== undefined) {
      assertPositive("minBarSpacing", options.minBarSpacing);
      this.minBarSpacing = options.minBarSpacing;
    }
    if (options.maxBarSpacing !== undefined) {
      assertPositive("maxBarSpacing", options.maxBarSpacing);
      this.maxBarSpacing = options.maxBarSpacing;
    }
    if (this.maxBarSpacing < this.minBarSpacing) {
      fail("INVALID_ARGUMENT", "maxBarSpacing must be greater than or equal to minBarSpacing");
    }
    if (options.timeVisible !== undefined) {
      this.timeVisible = options.timeVisible;
    }
    if (options.secondsVisible !== undefined) {
      this.secondsVisible = options.secondsVisible;
    }
  }

  private rightEdgeIndex(): number {
    return this.lastIndex() + this.rightOffset;
  }

  private lastIndex(): number {
    return this.source.count() - 1;
  }

  private clamp(): void {
    this.barSpacing = clamp(this.barSpacing, this.minBarSpacing, this.maxBarSpacing);

    const count = this.source.count();
    if (count === 0) {
      this.rightOffset = 0;
      return;
    }

    const minimum = -(count - 1);
    const maximum = Math.max(10, count * 0.5);
    this.rightOffset = clamp(this.rightOffset, minimum, maximum);
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    fail("INVALID_ARGUMENT", `${name} must be a positive finite number`);
  }
}
