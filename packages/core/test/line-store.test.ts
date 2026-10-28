import { describe, expect, it } from "vitest";

import { LineStore } from "../src/data/line-store";

describe("LineStore", () => {
  it("validates ascending finite points", () => {
    const store = new LineStore();
    expect(() =>
      store.setData([
        { time: 0, value: 1 },
        { time: 0, value: 2 },
      ]),
    ).toThrow(/strictly ascending/);
    expect(() => store.setData([{ time: 0, value: Number.NaN }])).toThrow(/value/);
  });

  it("updates, appends, and revises the last point", () => {
    const store = new LineStore();
    store.setData([
      { time: 0, value: 10 },
      { time: 60_000, value: 20 },
    ]);
    store.update({ time: 120_000, value: 30 });
    store.update({ time: 120_000, value: 35 });
    expect(store.length).toBe(3);
    expect(store.valueAt(2)).toBe(35);
    expect(() => store.update({ time: 0, value: 1 })).toThrow(/greater than or equal/);
  });

  it("merges overlapping data and reports bounds", () => {
    const store = new LineStore();
    store.setData([
      { time: 60_000, value: 10 },
      { time: 120_000, value: 20 },
    ]);
    const result = store.merge([
      { time: 0, value: 5 },
      { time: 60_000, value: 15 },
      { time: 180_000, value: 25 },
    ]);

    expect(result).toEqual({ prepended: 1, appended: 1, replaced: 1 });
    expect(store.length).toBe(4);
    expect(store.firstTime()).toBe(0);
    expect(store.lastTime()).toBe(180_000);
    expect(store.valueAt(1)).toBe(15);
    expect(store.minMax(0, 3)).toEqual({ min: 5, max: 25 });
    expect(store.nearestIndex(110_000)).toBe(2);
  });
});
