import { describe, expect, it } from "vitest";

import { TimeScale, type TimeScaleSource } from "../src/scale/time-scale";

const MINUTE = 60_000;

function source(count: number): TimeScaleSource {
  return {
    count: () => count,
    timeAt: (index) => (index >= 0 && index < count ? index * MINUTE : undefined),
    nearestIndex: (time) => Math.max(0, Math.min(count - 1, Math.round(time / MINUTE))),
  };
}

describe("TimeScale", () => {
  it("fits content and reports a visible range", () => {
    const scale = new TimeScale(source(100));
    scale.setWidth(800);
    scale.fitContent();

    const range = scale.getVisibleRange();
    expect(range.from).toBe(0);
    expect(range.to).toBe(99 * MINUTE);
    expect(scale.getBarSpacing()).toBeGreaterThan(0);
  });

  it("fits 100k bars by allowing sub-pixel spacing", () => {
    const scale = new TimeScale(source(100_000));
    scale.setWidth(800);
    scale.fitContent();

    expect(scale.getBarSpacing()).toBeLessThan(0.05);

    const range = scale.getVisibleRange();
    expect(range.from).toBe(0);
    expect(range.to).toBe(99_999 * MINUTE);
  });

  it("leaves a visible right margin when fitting", () => {
    const scale = new TimeScale(source(100));
    scale.setWidth(800);
    scale.fitContent();

    expect(scale.indexToX(99)).toBeCloseTo(792, 0);
  });

  it("pans without losing the data", () => {
    const scale = new TimeScale(source(100));
    scale.setWidth(800);
    scale.fitContent();

    const before = scale.getRightOffset();
    scale.pan(120);
    expect(scale.getRightOffset()).toBeLessThan(before);
  });

  it("zooms around the anchor index", () => {
    const scale = new TimeScale(source(100));
    scale.setWidth(800);
    scale.fitContent();

    const anchor = 400;
    const before = scale.xToIndex(anchor);
    scale.zoomAt(anchor, -120);
    const after = scale.xToIndex(anchor);

    expect(after).toBeCloseTo(before, 1);
    expect(scale.getBarSpacing()).toBeGreaterThan(0);
  });

  it("caps zoom-out at maxVisibleBars", () => {
    const scale = new TimeScale(source(1_000), { maxVisibleBars: 100 });
    scale.setWidth(800);
    scale.fitContent();

    expect(scale.getOptions().maxVisibleBars).toBe(100);
    expect(visibleBars(scale)).toBeLessThanOrEqual(100);

    scale.zoomAt(400, 10_000);
    expect(visibleBars(scale)).toBeLessThanOrEqual(100);

    scale.setWidth(1_600);
    expect(visibleBars(scale)).toBeLessThanOrEqual(100);
  });

  it("applies a zoom-out cap to explicit ranges and option changes", () => {
    const scale = new TimeScale(source(1_000), { maxVisibleBars: 100 });
    scale.setWidth(800);

    scale.setVisibleRange({ from: 0, to: 500 * MINUTE });
    expect(visibleBars(scale)).toBeLessThanOrEqual(100);

    scale.setOptions({ maxVisibleBars: 40 });
    expect(scale.getOptions().maxVisibleBars).toBe(40);
    expect(visibleBars(scale)).toBeLessThanOrEqual(40);
  });

  it("rejects invalid maxVisibleBars", () => {
    expect(() => new TimeScale(source(10), { maxVisibleBars: 0 })).toThrow(/positive integer/);
    expect(() => new TimeScale(source(10), { maxVisibleBars: 1.5 })).toThrow(/positive integer/);
  });

  it("sets a visible range from times", () => {
    const scale = new TimeScale(source(100));
    scale.setWidth(800);
    scale.setVisibleRange({ from: 10 * MINUTE, to: 20 * MINUTE });

    const range = scale.getVisibleRange();
    expect(range.from).toBe(10 * MINUTE);
    expect(range.to).toBe(20 * MINUTE);
  });

  it("scrolls a time into view", () => {
    const scale = new TimeScale(source(100));
    scale.setWidth(800);
    scale.fitContent();
    scale.scrollToTime(50 * MINUTE);

    const range = scale.getVisibleRange();
    expect(range.from).toBeLessThanOrEqual(50 * MINUTE);
    expect(range.to).toBeGreaterThanOrEqual(50 * MINUTE);
  });

  it("extends time coordinates into empty space after the last bar", () => {
    const scale = new TimeScale(source(100));
    scale.setWidth(800);
    scale.fitContent();

    const last = 99 * MINUTE;
    const future = last + 10 * MINUTE;
    const extended = scale.getVisibleTimeRange();

    expect(extended.to).toBeGreaterThan(last);
    expect(scale.timeToX(future)).toBeGreaterThan(scale.timeToX(last)!);
    expect(scale.timeAtX(800)).toBeGreaterThan(last);
  });

  it("handles an empty source", () => {
    const scale = new TimeScale(source(0));
    scale.setWidth(800);
    scale.fitContent();

    expect(scale.getVisibleRange()).toEqual({ from: 0, to: 0 });
  });

  it("rejects an invalid range", () => {
    const scale = new TimeScale(source(100));
    expect(() => scale.setVisibleRange({ from: 20 * MINUTE, to: 10 * MINUTE })).toThrow(
      /to > from/,
    );
  });
});

function visibleBars(scale: TimeScale): number {
  const range = scale.visibleIndexRange();
  return range.last - range.first + 1;
}
