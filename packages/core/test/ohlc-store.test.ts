import { describe, expect, it } from "vitest";

import { OhlcStore } from "../src/data/ohlc-store";
import { isWickError } from "../src/errors";
import type { OhlcData } from "../src/types";

function bar(time: number, overrides: Partial<OhlcData> = {}): OhlcData {
  return {
    time,
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    ...overrides,
  };
}

describe("OhlcStore", () => {
  it("stores bars and answers index queries", () => {
    const store = new OhlcStore();
    store.setData([bar(0), bar(60_000), bar(120_000)]);

    expect(store.length).toBe(3);
    expect(store.timeAt(1)).toBe(60_000);
    expect(store.closeAt(2)).toBe(102);
    expect(store.indexOf(60_000)).toBe(1);
    expect(store.indexOf(90_000)).toBe(-1);
    expect(store.nearestIndex(50_000)).toBe(1);
    expect(store.nearestIndex(30_000)).toBe(0);
  });

  it("rejects unsorted, duplicate, and invalid bars", () => {
    const store = new OhlcStore();

    expect(() => store.setData([bar(60_000), bar(0)])).toThrow(/strictly ascending/);
    expect(() => store.setData([bar(0), bar(0)])).toThrow(/strictly ascending/);
    expect(() => store.setData([bar(-1)])).toThrow(/non-negative/);
    expect(() => store.setData([bar(0, { high: 90 })])).toThrow(/high must be greater/);
    expect(() => store.setData([bar(0, { close: 200 })])).toThrow(/high must be greater/);
    expect(() => store.setData([bar(0, { open: Number.NaN })])).toThrow(/finite/);
  });

  it("reports WICKLIB error codes for invalid data", () => {
    const store = new OhlcStore();

    try {
      store.setData([bar(0), bar(0)]);
      expect.unreachable();
    } catch (error) {
      expect(isWickError(error)).toBe(true);
      if (isWickError(error)) {
        expect(error.code).toBe("INVALID_DATA");
        expect(error.details?.index).toBe(1);
      }
    }
  });

  it("replaces the last bar on equal time and appends on later time", () => {
    const store = new OhlcStore();
    store.setData([bar(60_000)]);

    store.update(bar(60_000, { close: 110, high: 115, low: 90 }));
    expect(store.length).toBe(1);
    expect(store.closeAt(0)).toBe(110);

    store.update(bar(120_000));
    expect(store.length).toBe(2);

    expect(() => store.update(bar(30_000))).toThrow(/greater than or equal/);
  });

  it("computes min and max over a range", () => {
    const store = new OhlcStore();
    store.setData([
      bar(0, { low: 90, high: 110 }),
      bar(60_000, { low: 80, high: 120 }),
      bar(120_000, { low: 95, high: 105 }),
    ]);

    expect(store.minMax(0, 2)).toEqual({ min: 80, max: 120 });
    expect(store.minMax(1, 2)).toEqual({ min: 80, max: 120 });
    expect(store.minMax(2, 1)).toBeNull();
  });
});

describe("OhlcStore.merge", () => {
  const BASE = 1_000_000;
  const MINUTE = 60_000;

  it("appends bars after the last", () => {
    const store = new OhlcStore();
    store.setData([bar(BASE), bar(BASE + MINUTE)]);

    const result = store.merge([bar(BASE + 2 * MINUTE), bar(BASE + 3 * MINUTE)]);

    expect(result).toEqual({ prepended: 0, appended: 2, replaced: 0 });
    expect(store.length).toBe(4);
    expect(store.lastTime()).toBe(BASE + 3 * MINUTE);
  });

  it("prepends bars before the first", () => {
    const store = new OhlcStore();
    store.setData([bar(BASE + 2 * MINUTE), bar(BASE + 3 * MINUTE)]);

    const result = store.merge([bar(BASE), bar(BASE + MINUTE)]);

    expect(result).toEqual({ prepended: 2, appended: 0, replaced: 0 });
    expect(store.length).toBe(4);
    expect(store.firstTime()).toBe(BASE);
    expect(store.timeAt(0)).toBe(BASE);
    expect(store.timeAt(2)).toBe(BASE + 2 * MINUTE);
  });

  it("replaces overlaps and inserts gaps", () => {
    const store = new OhlcStore();
    store.setData([bar(BASE), bar(BASE + 2 * MINUTE)]);

    const result = store.merge([
      bar(BASE + MINUTE),
      bar(BASE + 2 * MINUTE, { close: 210, high: 215 }),
      bar(BASE + 3 * MINUTE),
    ]);

    expect(result).toEqual({ prepended: 0, appended: 1, replaced: 1 });
    expect(store.length).toBe(4);
    expect(store.timeAt(1)).toBe(BASE + MINUTE);
    expect(store.closeAt(2)).toBe(210);
  });

  it("rejects unsorted incoming data", () => {
    const store = new OhlcStore();
    store.setData([bar(BASE)]);

    expect(() => store.merge([bar(BASE + MINUTE), bar(BASE)])).toThrow(/strictly ascending/);
  });

  it("reports first and last time", () => {
    const store = new OhlcStore();
    expect(store.firstTime()).toBeNull();
    expect(store.lastTime()).toBeNull();

    store.setData([bar(BASE), bar(BASE + MINUTE)]);
    expect(store.firstTime()).toBe(BASE);
    expect(store.lastTime()).toBe(BASE + MINUTE);
  });
});
