import { fail } from "../errors";
import type { Time, TimeScaleOptions, VisibleRange } from "../types";
import { SessionCalendar } from "./session-calendar";
import { generateTimeTicks } from "./ticks";

export interface TimeScaleSource {
  /** Number of bars available. */
  count(): number;
  /** Time at an index, or undefined when out of range. */
  timeAt(index: number): Time | undefined;
  /** Nearest index to a time. */
  nearestIndex(time: Time): number;
}

const DEFAULT_OPTIONS: Required<Omit<TimeScaleOptions, "calendar">> = {
  barSpacing: 8,
  rightOffset: 2,
  minBarSpacing: 0.001,
  maxBarSpacing: 200,
  maxVisibleBars: Number.POSITIVE_INFINITY,
  gapMode: "compress",
  gapWidth: 12,
  timeVisible: true,
  secondsVisible: false,
  borderVisible: true,
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
  private maxVisibleBars = DEFAULT_OPTIONS.maxVisibleBars;
  private calendar: SessionCalendar | null = null;
  private gapMode: "compress" | "show" = DEFAULT_OPTIONS.gapMode;
  private gapWidth = DEFAULT_OPTIONS.gapWidth;
  private gapPrefix = new Int32Array(0);
  private totalGaps = 0;
  private timeVisible = DEFAULT_OPTIONS.timeVisible;
  private secondsVisible = DEFAULT_OPTIONS.secondsVisible;
  private borderVisible = DEFAULT_OPTIONS.borderVisible;
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

  getOptions(): Required<Omit<TimeScaleOptions, "calendar">> {
    return {
      barSpacing: this.barSpacing,
      rightOffset: this.rightOffset,
      minBarSpacing: this.minBarSpacing,
      maxBarSpacing: this.maxBarSpacing,
      maxVisibleBars: this.maxVisibleBars,
      gapMode: this.gapMode,
      gapWidth: this.gapWidth,
      timeVisible: this.timeVisible,
      secondsVisible: this.secondsVisible,
      borderVisible: this.borderVisible,
    };
  }

  setOptions(options: TimeScaleOptions): void {
    this.applyOptions(options);
    this.clamp();
  }

  onDataChanged(): void {
    this.rebuildGaps();
    this.clamp();
  }

  getCalendarTimezone(): string | null {
    return this.calendar?.timezone ?? null;
  }

  getTimeTicks(width: number): number[] {
    const visible = this.getVisibleTimeRange();
    const span = visible.to - visible.from;
    const ticks = generateTimeTicks(visible.from, visible.to, width);
    if (!this.calendar || span <= 0 || span > 2 * 86_400_000) {
      return ticks;
    }

    const intervals = this.calendar.sessionsBetween(visible.from, visible.to);
    const opens: number[] = [];
    const closes: number[] = [];
    const selected: number[] = [];

    for (const interval of intervals) {
      if (interval.start >= visible.from && interval.start <= visible.to) {
        opens.push(interval.start);
      }
      if (interval.end >= visible.from && interval.end <= visible.to) {
        closes.push(interval.end);
      }
    }

    const add = (time: number): void => {
      const x = this.timeToX(time);
      if (x === null) {
        return;
      }
      if (
        selected.every((candidate) => {
          const candidateX = this.timeToX(candidate);
          return candidateX === null || Math.abs(candidateX - x) >= 80;
        })
      ) {
        selected.push(time);
      }
    };

    for (const open of opens) {
      add(open);
    }
    for (const close of closes) {
      add(close);
    }
    for (const tick of ticks) {
      if (this.calendar.isOpen(tick)) {
        add(tick);
      }
    }

    return selected.sort((first, second) => first - second);
  }

  indexToX(index: number): number {
    return this.width - (this.rightEdgeLayout() - this.layoutIndex(index)) * this.barSpacing;
  }

  xToIndex(x: number): number {
    return this.layoutToIndex(this.rightEdgeLayout() - (this.width - x) / this.barSpacing);
  }

  isGapX(x: number): boolean {
    if (this.gapMode !== "show" || this.totalGaps === 0) {
      return false;
    }
    const layout = this.rightEdgeLayout() - (this.width - x) / this.barSpacing;
    const index = this.layoutBarIndex(layout);
    if (index < 0 || index >= this.source.count() - 1) {
      return false;
    }
    const start = this.layoutStart(index);
    const local = layout - start;
    const gapUnits = this.gapUnitsAfter(index);
    return gapUnits > 0 && local > 1 && local < 1 + gapUnits;
  }

  hasGapBetween(first: number, last: number): boolean {
    if (this.gapMode !== "show" || this.totalGaps === 0) {
      return false;
    }
    const count = this.source.count();
    const from = Math.max(0, Math.min(count - 1, Math.floor(first)));
    const to = Math.max(0, Math.min(count - 1, Math.floor(last)));
    if (to <= from) {
      return false;
    }
    return (this.gapPrefix[to] ?? 0) - (this.gapPrefix[from] ?? 0) > 0;
  }

  timeToX(time: Time): number | null {
    const count = this.source.count();
    if (count === 0) {
      return null;
    }

    const first = this.source.timeAt(0);
    const last = this.source.timeAt(count - 1);
    if (first === undefined || last === undefined) {
      return null;
    }

    if (time < first) {
      return this.indexToX((time - first) / this.timeStep());
    }
    if (time > last) {
      return this.indexToX(count - 1 + (time - last) / this.timeStep());
    }

    const index = this.source.nearestIndex(time);
    return index < 0 ? null : this.indexToX(index);
  }

  timeAtX(x: number): Time | null {
    if (this.source.count() === 0) {
      return null;
    }
    return this.timeAtIndex(Math.round(this.xToIndex(x)));
  }

  /** Visible time range including empty space to the left or right of the data. */
  getVisibleTimeRange(): VisibleRange {
    if (this.source.count() === 0) {
      return { from: 0, to: 0 };
    }
    return {
      from: this.timeAtIndex(this.xToIndex(0), false),
      to: this.timeAtIndex(this.xToIndex(this.width), false),
    };
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
    const nextSpacing = clamp(
      this.barSpacing * factor,
      this.minimumBarSpacing(),
      this.maxBarSpacing,
    );
    if (nextSpacing === this.barSpacing) {
      return;
    }

    const anchorIndex = this.xToIndex(anchorX);
    this.barSpacing = nextSpacing;
    this.rightOffset =
      this.layoutIndex(anchorIndex) +
      (this.width - anchorX) / this.barSpacing -
      this.lastIndex() -
      this.totalGaps * this.gapUnits();
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
    const gapPixels = this.gapMode === "show" ? this.totalGaps * this.gapWidth : 0;
    this.barSpacing = clamp(
      Math.max(1, usable - gapPixels) / Math.max(1, count - 1),
      this.minimumBarSpacing(),
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

    const gaps =
      this.gapMode === "show"
        ? Math.max(0, this.gapPrefix[last]! - this.gapPrefix[first]!) * this.gapWidth
        : 0;
    this.barSpacing = clamp(
      Math.max(1, this.width - gaps) / Math.max(1, last - first),
      this.minimumBarSpacing(),
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
    this.rightOffset =
      this.layoutIndex(index) + half - this.lastIndex() - this.totalGaps * this.gapUnits();
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
    if (options.maxVisibleBars !== undefined) {
      if (!Number.isInteger(options.maxVisibleBars) || options.maxVisibleBars <= 0) {
        fail("INVALID_ARGUMENT", "maxVisibleBars must be a positive integer");
      }
      this.maxVisibleBars = options.maxVisibleBars;
    }
    if (options.calendar !== undefined) {
      this.calendar = options.calendar ? new SessionCalendar(options.calendar) : null;
    }
    if (options.gapMode !== undefined) {
      this.gapMode = options.gapMode;
    }
    if (options.gapWidth !== undefined) {
      assertPositive("gapWidth", options.gapWidth);
      this.gapWidth = options.gapWidth;
    }
    if (this.maxBarSpacing < this.minBarSpacing) {
      fail("INVALID_ARGUMENT", "maxBarSpacing must be greater than or equal to minBarSpacing");
    }
    this.rebuildGaps();
    if (options.timeVisible !== undefined) {
      this.timeVisible = options.timeVisible;
    }
    if (options.secondsVisible !== undefined) {
      this.secondsVisible = options.secondsVisible;
    }
    if (options.borderVisible !== undefined) {
      this.borderVisible = options.borderVisible;
    }
  }

  private rightEdgeLayout(): number {
    return this.lastIndex() + this.totalGaps * this.gapUnits() + this.rightOffset;
  }

  private gapUnits(): number {
    return this.gapMode === "show" ? this.gapWidth / this.barSpacing : 0;
  }

  private rebuildGaps(): void {
    const count = this.source.count();
    this.gapPrefix = new Int32Array(count);
    this.totalGaps = 0;

    if (this.gapMode !== "show" || !this.calendar || count < 2) {
      return;
    }

    const step = this.timeStep();
    let gaps = 0;
    for (let index = 0; index < count; index += 1) {
      this.gapPrefix[index] = gaps;
      if (index + 1 >= count) {
        continue;
      }
      const time = this.source.timeAt(index);
      const next = this.source.timeAt(index + 1);
      if (
        time !== undefined &&
        next !== undefined &&
        next - time > step * 1.5 &&
        (!this.calendar.isOpen(time + step) || !this.calendar.isOpen(next - step))
      ) {
        gaps += 1;
      }
    }
    this.totalGaps = gaps;
  }

  private layoutStart(index: number): number {
    const count = this.source.count();
    const units = this.gapUnits();
    if (count === 0) {
      return index;
    }
    const clamped = Math.max(0, Math.min(count - 1, index));
    return clamped + (this.gapPrefix[clamped] ?? 0) * units;
  }

  private layoutIndex(index: number): number {
    const count = this.source.count();
    const units = this.gapUnits();
    if (count === 0 || this.totalGaps === 0 || units === 0) {
      return index;
    }
    if (index <= 0) {
      return index;
    }
    if (index >= count - 1) {
      return index + this.totalGaps * units;
    }
    const base = Math.floor(index);
    const fraction = index - base;
    const gapsBefore = this.gapPrefix[base] ?? 0;
    const gapAfter = (this.gapPrefix[base + 1] ?? gapsBefore) - gapsBefore;
    return base + gapsBefore * units + fraction * (1 + gapAfter * units);
  }

  private layoutToIndex(layout: number): number {
    const count = this.source.count();
    const units = this.gapUnits();
    if (count === 0 || this.totalGaps === 0 || units === 0 || layout <= 0) {
      return layout;
    }
    const last = count - 1;
    if (layout >= this.layoutStart(last)) {
      return last + (layout - this.layoutStart(last));
    }

    let low = 0;
    let high = last;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (this.layoutStart(middle) <= layout) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }

    const start = this.layoutStart(low);
    const local = layout - start;
    const gapUnits = this.gapUnitsAfter(low);
    return gapUnits > 0 && local > 1 ? low + local / (1 + gapUnits) : low + local;
  }

  private layoutBarIndex(layout: number): number {
    const count = this.source.count();
    if (count === 0) {
      return -1;
    }
    if (this.totalGaps === 0 || this.gapUnits() === 0) {
      return Math.floor(layout);
    }
    const last = count - 1;
    if (layout >= this.layoutStart(last)) {
      return last;
    }
    let low = 0;
    let high = last;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (this.layoutStart(middle) <= layout) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    return low;
  }

  private gapUnitsAfter(index: number): number {
    if (index < 0 || index >= this.source.count() - 1) {
      return 0;
    }
    return ((this.gapPrefix[index + 1] ?? 0) - (this.gapPrefix[index] ?? 0)) * this.gapUnits();
  }

  private timeStep(): number {
    const count = this.source.count();
    if (count < 2) {
      return 60_000;
    }
    const last = this.source.timeAt(count - 1);
    const previous = this.source.timeAt(count - 2);
    if (last === undefined || previous === undefined || last <= previous) {
      return 60_000;
    }
    return last - previous;
  }

  private timeAtIndex(index: number, snap = true): Time {
    const count = this.source.count();
    const lastIndex = count - 1;
    const first = this.source.timeAt(0) ?? 0;
    const last = this.source.timeAt(lastIndex) ?? first;

    if (index < 0) {
      return first + index * this.timeStep();
    }
    if (index > lastIndex) {
      return last + (index - lastIndex) * this.timeStep();
    }
    if (!snap) {
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      if (lower === upper) {
        return this.source.timeAt(lower) ?? first;
      }
      const from = this.source.timeAt(lower) ?? first;
      const to = this.source.timeAt(upper) ?? from;
      return from + (to - from) * (index - lower);
    }
    return this.source.timeAt(Math.round(index)) ?? first;
  }

  private lastIndex(): number {
    return this.source.count() - 1;
  }

  private minimumBarSpacing(): number {
    if (!Number.isFinite(this.maxVisibleBars)) {
      return this.minBarSpacing;
    }
    return Math.min(
      this.maxBarSpacing,
      Math.max(this.minBarSpacing, this.width / Math.max(1, this.maxVisibleBars - 1)),
    );
  }

  private clamp(): void {
    this.barSpacing = clamp(this.barSpacing, this.minimumBarSpacing(), this.maxBarSpacing);

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
