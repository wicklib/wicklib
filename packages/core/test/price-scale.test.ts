import { describe, expect, it } from "vitest";

import { PriceScale } from "../src/scale/price-scale";
import { logarithmicPriceTicks, nicePriceTicks, precisionForMinMove } from "../src/scale/ticks";

describe("PriceScale", () => {
  it("auto-ranges with margins", () => {
    const scale = new PriceScale({ scaleMargins: { top: 0.1, bottom: 0.1 } });
    scale.setAutoRange(100, 200);
    expect(scale.getVisibleRange()).toEqual({ min: 90, max: 210 });
  });

  it("maps prices to y and back", () => {
    const scale = new PriceScale();
    scale.setVisibleRange({ min: 100, max: 200 });

    expect(scale.priceToY(100, 0, 400)).toBe(400);
    expect(scale.priceToY(200, 0, 400)).toBe(0);
    expect(scale.yToPrice(200, 0, 400)).toBeCloseTo(150);
  });

  it("inverts the axis", () => {
    const scale = new PriceScale({ invertScale: true });
    scale.setVisibleRange({ min: 100, max: 200 });

    expect(scale.priceToY(100, 0, 400)).toBe(0);
    expect(scale.priceToY(200, 0, 400)).toBe(400);
  });

  it("disables auto scale when a manual range is set", () => {
    const scale = new PriceScale();
    expect(scale.isAutoScale()).toBe(true);

    scale.setVisibleRange({ min: 1, max: 2 });
    expect(scale.isAutoScale()).toBe(false);

    scale.setAutoScale(true);
    expect(scale.isAutoScale()).toBe(true);
  });

  it("maps logarithmic prices through log space", () => {
    const scale = new PriceScale({ mode: "logarithmic" });
    scale.setVisibleRange({ min: 1, max: 100 });

    expect(scale.isLogarithmic()).toBe(true);
    expect(scale.priceToY(1, 0, 400)).toBe(400);
    expect(scale.priceToY(10, 0, 400)).toBe(200);
    expect(scale.priceToY(100, 0, 400)).toBe(0);
    expect(scale.yToPrice(200, 0, 400)).toBeCloseTo(10);
  });

  it("applies logarithmic auto-range margins in log space", () => {
    const scale = new PriceScale({
      mode: "logarithmic",
      scaleMargins: { top: 0.1, bottom: 0.1 },
    });
    scale.setAutoRange(1, 100);
    const range = scale.getVisibleRange();

    expect(range.min).toBeCloseTo(10 ** -0.2);
    expect(range.max).toBeCloseTo(10 ** 2.2);
  });

  it("inverts a logarithmic axis", () => {
    const scale = new PriceScale({ mode: "logarithmic", invertScale: true });
    scale.setVisibleRange({ min: 1, max: 100 });

    expect(scale.priceToY(1, 0, 400)).toBe(0);
    expect(scale.priceToY(100, 0, 400)).toBe(400);
    expect(scale.yToPrice(200, 0, 400)).toBeCloseTo(10);
  });

  it("requires positive explicit ranges in logarithmic mode", () => {
    const scale = new PriceScale({ mode: "logarithmic" });

    expect(() => scale.setVisibleRange({ min: 0, max: 100 })).toThrow(/positive/);
    expect(() => scale.setVisibleRange({ min: -1, max: 100 })).toThrow(/positive/);

    const manual = new PriceScale();
    manual.setVisibleRange({ min: -100, max: 100 });
    expect(() => manual.setOptions({ mode: "logarithmic" })).toThrow(/positive/);
  });

  it("ignores non-positive auto-ranges in logarithmic mode", () => {
    const scale = new PriceScale({ mode: "logarithmic" });
    scale.setAutoRange(1, 10);
    const range = scale.getVisibleRange();

    scale.setAutoRange(-5, 10);
    expect(scale.getVisibleRange()).toEqual(range);
  });

  it("exposes the active price scale mode", () => {
    const scale = new PriceScale();
    expect(scale.getOptions().mode).toBe("normal");

    scale.setOptions({ mode: "logarithmic" });
    expect(scale.getOptions().mode).toBe("logarithmic");
    expect(scale.isLogarithmic()).toBe(true);

    scale.setOptions({ mode: "normal" });
    expect(scale.getOptions().mode).toBe("normal");
  });

  it("generates logarithmic ticks and label precision", () => {
    expect(logarithmicPriceTicks(1, 1_000, 6).map((tick) => tick.value)).toEqual([
      1, 2, 5, 10, 20, 50, 100, 200, 500, 1_000,
    ]);
    expect(logarithmicPriceTicks(100, 200, 6).length).toBeGreaterThan(2);
    expect(logarithmicPriceTicks(0, 100, 6)).toEqual([]);

    const scale = new PriceScale({ mode: "logarithmic" });
    scale.setVisibleRange({ min: 0.001, max: 100 });
    expect(scale.precision()).toBe(3);
    expect(scale.formatValue(0.001, "en-US")).toBe("0.001");
  });

  it("generates nice ticks", () => {
    const ticks = nicePriceTicks(0, 100, 5);
    expect(ticks.length).toBeGreaterThan(3);
    expect(ticks[0]?.value).toBe(0);
    expect(ticks.at(-1)?.value).toBe(100);
  });

  it("formats with an explicit precision", () => {
    const scale = new PriceScale({ priceFormat: { precision: 4 } });
    scale.setAutoRange(1234.5, 1234.5);

    expect(scale.precision()).toBe(4);
    expect(scale.formatValue(1234.5, "en-US")).toBe("1,234.5000");
  });

  it("infers precision from minMove", () => {
    const scale = new PriceScale({ priceFormat: { minMove: 0.25 } });
    scale.setAutoRange(100.25, 100.25);

    expect(scale.precision()).toBe(2);
    expect(scale.formatValue(100.25, "en-US")).toBe("100.25");
    expect(precisionForMinMove(1)).toBe(0);
    expect(precisionForMinMove(0.00000001)).toBe(8);
  });

  it("prefers explicit precision over minMove", () => {
    const scale = new PriceScale({ priceFormat: { precision: 1, minMove: 0.25 } });

    expect(scale.precision()).toBe(1);
    expect(scale.formatValue(100.25, "en-US")).toBe("100.3");
  });

  it("merges partial format updates and exposes resolved options", () => {
    const scale = new PriceScale({ priceFormat: { precision: 4 } });
    scale.setOptions({ priceFormat: { minMove: 0.01 } });

    expect(scale.getOptions().priceFormat).toEqual({ precision: 4, minMove: 0.01 });
  });

  it("rejects invalid price format options", () => {
    expect(() => new PriceScale({ priceFormat: { precision: -1 } })).toThrow(/precision/);
    expect(() => new PriceScale({ priceFormat: { precision: 1.5 } })).toThrow(/precision/);
    expect(() => new PriceScale({ priceFormat: { minMove: 0 } })).toThrow(/minMove/);
    expect(() => new PriceScale({ priceFormat: { minMove: Number.POSITIVE_INFINITY } })).toThrow(
      /minMove/,
    );
  });

  it("keeps price ticks dense enough for tall panes", () => {
    const scale = new PriceScale();
    scale.setVisibleRange({ min: 100, max: 200 });
    expect(scale.ticks(400).length).toBeGreaterThanOrEqual(8);
  });
});
