import { fail } from "../errors";
import type { LineData, Time } from "../types";
import type { MergeResult, MutableSeriesStore } from "./series-store";

function invalid(message: string, index: number): never {
  fail("INVALID_DATA", message, { index });
}

function validatePoint(point: LineData, index: number): void {
  if (!Number.isFinite(point.time) || !Number.isInteger(point.time) || point.time < 0) {
    invalid("time must be a non-negative integer in milliseconds", index);
  }
  if (!Number.isFinite(point.value)) {
    invalid("value must be finite", index);
  }
}

function validateIncoming(data: readonly LineData[]): void {
  for (let index = 0; index < data.length; index += 1) {
    const point = data[index]!;
    validatePoint(point, index);
    if (index > 0 && point.time <= data[index - 1]!.time) {
      invalid("time values must be strictly ascending", index);
    }
  }
}

/**
 * Columnar storage for single-value series.
 */
export class LineStore implements MutableSeriesStore<LineData> {
  private times = new Float64Array(0);
  private values = new Float64Array(0);
  private count = 0;

  get length(): number {
    return this.count;
  }

  setData(data: readonly LineData[]): void {
    validateIncoming(data);
    this.ensureCapacity(data.length);
    for (let index = 0; index < data.length; index += 1) {
      this.times[index] = data[index]!.time;
      this.values[index] = data[index]!.value;
    }
    this.count = data.length;
  }

  update(point: LineData): void {
    validatePoint(point, this.count);

    if (this.count === 0) {
      this.ensureCapacity(1);
      this.write(0, point);
      this.count = 1;
      return;
    }

    const last = this.count - 1;
    const lastTime = this.times[last]!;
    if (point.time === lastTime) {
      this.write(last, point);
      return;
    }
    if (point.time > lastTime) {
      this.ensureCapacity(this.count + 1);
      this.write(this.count, point);
      this.count += 1;
      return;
    }
    invalid("update time must be greater than or equal to the last point", last);
  }

  timeAt(index: number): Time {
    return this.times[index]!;
  }

  valueAt(index: number): number {
    return this.values[index]!;
  }

  dataAt(index: number): LineData {
    return { time: this.times[index]!, value: this.values[index]! };
  }

  firstTime(): Time | null {
    return this.count === 0 ? null : this.times[0]!;
  }

  lastTime(): Time | null {
    return this.count === 0 ? null : this.times[this.count - 1]!;
  }

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
    return time - this.times[before]! <= this.times[after]! - time ? before : after;
  }

  minMax(first: number, last: number): { min: number; max: number } | null {
    const from = Math.max(0, first);
    const to = Math.min(this.count - 1, last);
    if (from > to) {
      return null;
    }
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let index = from; index <= to; index += 1) {
      const value = this.values[index]!;
      if (value < min) {
        min = value;
      }
      if (value > max) {
        max = value;
      }
    }
    return { min, max };
  }

  merge(data: readonly LineData[]): MergeResult {
    if (data.length === 0) {
      return { prepended: 0, appended: 0, replaced: 0 };
    }
    validateIncoming(data);
    if (this.count === 0) {
      this.setData(data);
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
      this.values.copyWithin(data.length, 0, this.count);
      for (let index = 0; index < data.length; index += 1) {
        this.write(index, data[index]!);
      }
      this.count += data.length;
      return { prepended: data.length, appended: 0, replaced: 0 };
    }

    let prepended = 0;
    for (const point of data) {
      if (point.time < oldFirst) {
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
    const values = new Float64Array(capacity);
    let oldIndex = 0;
    let newIndex = 0;
    let writeIndex = 0;
    let replaced = 0;

    while (oldIndex < this.count && newIndex < data.length) {
      const oldTime = this.times[oldIndex]!;
      const point = data[newIndex]!;
      if (oldTime < point.time) {
        times[writeIndex] = oldTime;
        values[writeIndex] = this.values[oldIndex]!;
        oldIndex += 1;
      } else if (oldTime > point.time) {
        times[writeIndex] = point.time;
        values[writeIndex] = point.value;
        newIndex += 1;
      } else {
        times[writeIndex] = point.time;
        values[writeIndex] = point.value;
        oldIndex += 1;
        newIndex += 1;
        replaced += 1;
      }
      writeIndex += 1;
    }
    while (oldIndex < this.count) {
      times[writeIndex] = this.times[oldIndex]!;
      values[writeIndex] = this.values[oldIndex]!;
      oldIndex += 1;
      writeIndex += 1;
    }
    while (newIndex < data.length) {
      times[writeIndex] = data[newIndex]!.time;
      values[writeIndex] = data[newIndex]!.value;
      newIndex += 1;
      writeIndex += 1;
    }

    this.times = times;
    this.values = values;
    this.count = writeIndex;
    return { prepended, appended, replaced };
  }

  clear(): void {
    this.count = 0;
  }

  private write(index: number, point: LineData): void {
    this.times[index] = point.time;
    this.values[index] = point.value;
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
    const values = new Float64Array(capacity);
    times.set(this.times.subarray(0, this.count));
    values.set(this.values.subarray(0, this.count));
    this.times = times;
    this.values = values;
  }
}
