import type { SeriesData, Time } from "../types";

/**
 * Read-only series storage used by chart layout and rendering.
 */
export interface SeriesDataStore {
  readonly length: number;
  timeAt(index: number): Time;
  valueAt(index: number): number;
  nearestIndex(time: Time): number;
  minMax(first: number, last: number): { min: number; max: number } | null;
}

/**
 * Merge outcome shared by series stores.
 */
export interface MergeResult {
  prepended: number;
  appended: number;
  replaced: number;
}

/**
 * Mutable series storage used by datafeeds.
 */
export interface MutableSeriesStore<TData extends SeriesData> extends SeriesDataStore {
  setData(data: readonly TData[]): void;
  update(data: TData): void;
  merge(data: readonly TData[]): MergeResult;
  clear(): void;
  firstTime(): Time | null;
  lastTime(): Time | null;
}
