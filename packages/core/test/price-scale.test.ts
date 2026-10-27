import { describe, expect, it } from "vitest";

import { PriceScale } from "../src/scale/price-scale";
import { nicePriceTicks } from "../src/scale/ticks";

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

  it("rejects logarithmic mode in Phase 2", () => {
    expect(() => new PriceScale({ mode: "logarithmic" })).toThrow(/not implemented/i);
  });

  it("generates nice ticks", () => {
    const ticks = nicePriceTicks(0, 100, 5);
    expect(ticks.length).toBeGreaterThan(3);
    expect(ticks[0]?.value).toBe(0);
    expect(ticks.at(-1)?.value).toBe(100);
  });
});
