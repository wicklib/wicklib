import { fail } from "../errors";
import type { OhlcData, Time } from "../types";

function invalid(message: string, index: number): never {
  fail("INVALID_DATA", message, { index });
}

function validateBar(bar: OhlcData, index: number): void {
  if (!Number.isFinite(bar.time) || !Number.isInteger(bar.time) || bar.time < 0) {
    invalid("time must be a non-negative integer in milliseconds", index);
  }
  for (const key of ["open", "high", "low", "close"] as const) {
    if (!Number.isFinite(bar[key])) {
      invalid(`${key} must be finite`, index);
    }
  }
  if (bar.high < bar.low) {
    invalid("high must be greater than or equal to low", index);
  }
  if (bar.high < Math.max(bar.open, bar.close)) {
    invalid("high must be greater than or equal to open and close", index);
  }
  if (bar.low > Math.min(bar.open, bar.close)) {
    invalid("low must be less than or equal to open and close", index);
  }
}

function validateIncoming(data: readonly OhlcData[]): void {
  for (let i = 0; i < data.length; i += 1) {
    const bar = data[i]!;
    validateBar(bar, i);
    if (i > 0 && bar.time <= data[i - 1]!.time) {
      invalid("time values must be strictly ascending", i);
    }
  }
}

/**
 * Outcome of a merge, used by the datafeed controller.
 */
export interface MergeResult {
  prepended: number;
  appended: number;
  replaced: number;
}

/**
 * Columnar OHLC storage.
 *
 * Public input is an array of objects; internal storage is typed arrays so the render
 * loop never allocates per bar.
 */
export class OhlcStore {
  private times = new Float64Array(0);
  private opens = new Float64Array(0);
  private highs = new Float64Array(0);
  private lows = new Float64Array(0);
  private closes = new Float64Array(0);
  private count = 0;

  get length(): number {
    return this.count;
  }

  setData(data: readonly OhlcData[]): void {
    validateIncoming(data);
    this.ensureCapacity(data.length);
    for (let i = 0; i < data.length; i += 1) {
      const bar = data[i]!;
      this.times[i] = bar.time;
      this.opens[i] = bar.open;
      this.highs[i] = bar.high;
      this.lows[i] = bar.low;
      this.closes[i] = bar.close;
    }
    this.count = data.length;
  }

  update(bar: OhlcData): void {
    validateBar(bar, this.count);

    if (this.count === 0) {
      this.ensureCapacity(1);
      this.write(0, bar);
      this.count = 1;
      return;
    }

    const last = this.count - 1;
    const lastTime = this.times[last]!;

    if (bar.time === lastTime) {
      this.write(last, bar);
      return;
    }

    if (bar.time > lastTime) {
      this.ensureCapacity(this.count + 1);
      this.write(this.count, bar);
      this.count += 1;
      return;
    }

    invalid("update time must be greater than or equal to the last bar", last);
  }

  timeAt(index: number): Time {
    return this.times[index]!;
  }

  openAt(index: number): number {
    return this.opens[index]!;
  }

  highAt(index: number): number {
    return this.highs[index]!;
  }

  lowAt(index: number): number {
    return this.lows[index]!;
  }

  closeAt(index: number): number {
    return this.closes[index]!;
  }

  barAt(index: number): OhlcData {
    return {
      time: this.times[index]!,
      open: this.opens[index]!,
      high: this.highs[index]!,
      low: this.lows[index]!,
      close: this.closes[index]!,
    };
  }

  lastBar(): OhlcData | null {
    if (this.count === 0) {
      return null;
    }
    return this.barAt(this.count - 1);
  }

  firstTime(): Time | null {
    return this.count === 0 ? null : this.times[0]!;
  }

  lastTime(): Time | null {
    return this.count === 0 ? null : this.times[this.count - 1]!;
  }

  /**
   * Merges ascending data into the store, replacing duplicate times.
   *
   * New bars before the current first bar are prepended and new bars after the current
   * last bar are appended, both in place. Overlapping ranges take the general merge path.
   */
  merge(data: readonly OhlcData[]): MergeResult {
    if (data.length === 0) {
      return { prepended: 0, appended: 0, replaced: 0 };
    }

    validateIncoming(data);

    if (this.count === 0) {
      this.ensureCapacity(data.length);
      for (let index = 0; index < data.length; index += 1) {
        this.write(index, data[index]!);
      }
      this.count = data.length;
      return { prepended: 0, appended: data.length, replaced: 0 };
    }

    const oldFirst = this.times[0]!;
    const oldLast = this.times[this.count - 1]!;
    const newFirst = data[0]!.time;
    const newLast = data[data.length - 1]!.time;

    if (newFirst > oldLast) {
      this.ensureCapacity(this.count + data.length);
      for (let index = 0; index < data.length; index += 1) {
        this.write(this.count + index, data[index]!);
      }
      this.count += data.length;
      return { prepended: 0, appended: data.length, replaced: 0 };
    }

    if (newLast < oldFirst) {
      this.ensureCapacity(this.count + data.length);
      this.times.copyWithin(data.length, 0, this.count);
      this.opens.copyWithin(data.length, 0, this.count);
      this.highs.copyWithin(data.length, 0, this.count);
      this.lows.copyWithin(data.length, 0, this.count);
      this.closes.copyWithin(data.length, 0, this.count);
      for (let index = 0; index < data.length; index += 1) {
        this.write(index, data[index]!);
      }
      this.count += data.length;
      return { prepended: data.length, appended: 0, replaced: 0 };
    }

    let prepended = 0;
    for (const bar of data) {
      if (bar.time < oldFirst) {
        prepended += 1;
      } else {
        break;
      }
    }

    let appended = 0;
    for (let index = data.length - 1; index >= 0; index -= 1) {
      if (data[index]!.time > oldLast) {
        appended += 1;
      } else {
        break;
      }
    }

    const capacity = this.nextCapacity(this.count + data.length);
    const times = new Float64Array(capacity);
    const opens = new Float64Array(capacity);
    const highs = new Float64Array(capacity);
    const lows = new Float64Array(capacity);
    const closes = new Float64Array(capacity);

    let oldIndex = 0;
    let newIndex = 0;
    let writeIndex = 0;
    let replaced = 0;

    while (oldIndex < this.count && newIndex < data.length) {
      const oldTime = this.times[oldIndex]!;
      const bar = data[newIndex]!;

      if (oldTime < bar.time) {
        times[writeIndex] = oldTime;
        opens[writeIndex] = this.opens[oldIndex]!;
        highs[writeIndex] = this.highs[oldIndex]!;
        lows[writeIndex] = this.lows[oldIndex]!;
        closes[writeIndex] = this.closes[oldIndex]!;
        oldIndex += 1;
      } else if (oldTime > bar.time) {
        times[writeIndex] = bar.time;
        opens[writeIndex] = bar.open;
        highs[writeIndex] = bar.high;
        lows[writeIndex] = bar.low;
        closes[writeIndex] = bar.close;
        newIndex += 1;
      } else {
        times[writeIndex] = bar.time;
        opens[writeIndex] = bar.open;
        highs[writeIndex] = bar.high;
        lows[writeIndex] = bar.low;
        closes[writeIndex] = bar.close;
        oldIndex += 1;
        newIndex += 1;
        replaced += 1;
      }
      writeIndex += 1;
    }

    while (oldIndex < this.count) {
      times[writeIndex] = this.times[oldIndex]!;
      opens[writeIndex] = this.opens[oldIndex]!;
      highs[writeIndex] = this.highs[oldIndex]!;
      lows[writeIndex] = this.lows[oldIndex]!;
      closes[writeIndex] = this.closes[oldIndex]!;
      oldIndex += 1;
      writeIndex += 1;
    }

    while (newIndex < data.length) {
      const bar = data[newIndex]!;
      times[writeIndex] = bar.time;
      opens[writeIndex] = bar.open;
      highs[writeIndex] = bar.high;
      lows[writeIndex] = bar.low;
      closes[writeIndex] = bar.close;
      newIndex += 1;
      writeIndex += 1;
    }

    this.times = times;
    this.opens = opens;
    this.highs = highs;
    this.lows = lows;
    this.closes = closes;
    this.count = writeIndex;

    return { prepended, appended, replaced };
  }

  /** Exact index of a time, or -1. */
  indexOf(time: Time): number {
    let low = 0;
    let high = this.count - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const value = this.times[mid]!;
      if (value === time) {
        return mid;
      }
      if (value < time) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return -1;
  }

  /** Nearest index to a time; -1 when empty. */
  nearestIndex(time: Time): number {
    if (this.count === 0) {
      return -1;
    }

    const exact = this.indexOf(time);
    if (exact >= 0) {
      return exact;
    }

    let low = 0;
    let high = this.count - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.times[mid]! < time) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const after = low;
    const before = low - 1;
    if (after >= this.count) {
      return this.count - 1;
    }
    if (before < 0) {
      return 0;
    }

    const beforeDelta = time - this.times[before]!;
    const afterDelta = this.times[after]! - time;
    return beforeDelta <= afterDelta ? before : after;
  }

  /** Lowest low and highest high over an inclusive index range. */
  minMax(first: number, last: number): { min: number; max: number } | null {
    const from = Math.max(0, first);
    const to = Math.min(this.count - 1, last);
    if (from > to) {
      return null;
    }

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (let i = from; i <= to; i += 1) {
      const low = this.lows[i]!;
      const high = this.highs[i]!;
      if (low < min) {
        min = low;
      }
      if (high > max) {
        max = high;
      }
    }

    return { min, max };
  }

  clear(): void {
    this.count = 0;
  }

  private write(index: number, bar: OhlcData): void {
    this.times[index] = bar.time;
    this.opens[index] = bar.open;
    this.highs[index] = bar.high;
    this.lows[index] = bar.low;
    this.closes[index] = bar.close;
  }

  private nextCapacity(minimum: number): number {
    let capacity = Math.max(16, this.times.length);
    while (capacity < minimum) {
      capacity *= 2;
    }
    return capacity;
  }

  private ensureCapacity(minimum: number): void {
    if (this.times.length >= minimum) {
      return;
    }

    const capacity = this.nextCapacity(minimum);
    const times = new Float64Array(capacity);
    const opens = new Float64Array(capacity);
    const highs = new Float64Array(capacity);
    const lows = new Float64Array(capacity);
    const closes = new Float64Array(capacity);

    times.set(this.times.subarray(0, this.count));
    opens.set(this.opens.subarray(0, this.count));
    highs.set(this.highs.subarray(0, this.count));
    lows.set(this.lows.subarray(0, this.count));
    closes.set(this.closes.subarray(0, this.count));

    this.times = times;
    this.opens = opens;
    this.highs = highs;
    this.lows = lows;
    this.closes = closes;
  }
}
