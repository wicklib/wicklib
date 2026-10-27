import { describe, expect, it } from "vitest";

import type { IndicatorBars } from "@wicklib/core";

import { ATR, BollingerBands, EMA, MACD, RSI, SMA, VWAP } from "../src/index";

const BASE = Date.UTC(2024, 0, 1);

function barsFromCloses(
  closes: readonly number[],
  volumes?: ReadonlyArray<number | undefined>,
): IndicatorBars {
  return {
    length: closes.length,
    timeAt: (index) => BASE + index * 60_000,
    openAt: (index) => closes[index]!,
    highAt: (index) => closes[index]! + 1,
    lowAt: (index) => closes[index]! - 1,
    closeAt: (index) => closes[index]!,
    volumeAt: (index) => volumes?.[index],
  };
}

describe("indicator definitions", () => {
  it("expose free metadata and stable ids", () => {
    for (const definition of [SMA, EMA, RSI, MACD, BollingerBands, VWAP, ATR]) {
      expect(definition.meta.license).toBe("free");
      expect(definition.meta.id.startsWith("com.wicklib.")).toBe(true);
      expect(definition.plots.length).toBeGreaterThan(0);
    }
  });
});

describe("SMA", () => {
  it("computes a rolling average with a null warm-up", () => {
    const { sma } = SMA.compute({
      bars: barsFromCloses([1, 2, 3, 4, 5]),
      inputs: { period: 3, source: "close" },
    });

    expect(sma).toEqual([null, null, 2, 3, 4]);
  });
});

describe("EMA", () => {
  it("seeds with the SMA and smooths afterward", () => {
    const { ema } = EMA.compute({
      bars: barsFromCloses([1, 2, 3, 4, 5]),
      inputs: { period: 3, source: "close" },
    });

    expect(ema).toEqual([null, null, 2, 3, 4]);
  });
});

describe("RSI", () => {
  it("reaches 100 on a monotonic rise", () => {
    const { rsi } = RSI.compute({
      bars: barsFromCloses([1, 2, 3, 4, 5]),
      inputs: { period: 3, source: "close" },
    });

    expect(rsi).toEqual([null, null, null, 100, 100]);
  });
});

describe("BollingerBands", () => {
  it("computes middle, upper, and lower bands", () => {
    const { upper, middle, lower } = BollingerBands.compute({
      bars: barsFromCloses([1, 2, 3, 4]),
      inputs: { period: 3, multiplier: 2, source: "close" },
    });

    expect(middle).toEqual([null, null, 2, 3]);
    expect(upper![2]).toBeCloseTo(3.633, 2);
    expect(lower![2]).toBeCloseTo(0.367, 2);
    expect(upper![3]).toBeCloseTo(4.633, 2);
    expect(lower![3]).toBeCloseTo(1.367, 2);
  });
});

describe("ATR", () => {
  it("smooths true range with Wilder's average", () => {
    const { atr } = ATR.compute({
      bars: barsFromCloses([10, 11, 12, 13, 14]),
      inputs: { period: 3 },
    });

    expect(atr![0]).toBeNull();
    expect(atr![1]).toBeNull();
    expect(atr![2]).toBe(2);
    expect(atr![3]).toBe(2);
  });
});

describe("VWAP", () => {
  it("uses typical price and volume", () => {
    const bars = barsFromCloses([10, 20, 30], [1, 2, 3]);
    const { vwap } = VWAP.compute({
      bars,
      inputs: { source: "hlc3" },
    });

    expect(vwap![0]).toBeCloseTo(10, 5);
    expect(vwap![1]).toBeCloseTo(50 / 3, 5);
    expect(vwap![2]).toBeCloseTo(140 / 6, 5);
  });

  it("returns null when volume is missing", () => {
    const { vwap } = VWAP.compute({
      bars: barsFromCloses([10, 20], [undefined, 2]),
      inputs: { source: "hlc3" },
    });

    expect(vwap![0]).toBeNull();
    expect(vwap![1]).toBeCloseTo(20, 5);
  });
});

describe("MACD", () => {
  it("produces line, signal, and histogram with warm-ups", () => {
    const closes = Array.from({ length: 50 }, (_, index) => index + 1);
    const result = MACD.compute({
      bars: barsFromCloses(closes),
      inputs: { fast: 3, slow: 5, signal: 2, source: "close" },
    });

    expect(result.macd![3]).toBeNull();
    expect(result.macd![4]).toBeCloseTo(1, 5);
    expect(result.signal![5]).not.toBeNull();
    expect(result.histogram![5]).not.toBeNull();
  });
});
