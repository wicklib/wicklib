import { describe, expect, it } from "vitest";

import { CandlestickSeries, VERSION, WickError, assertFeature, isWickError } from "../src/index";

describe("@wicklib/core", () => {
  it("exposes a semantic version", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("exposes the candlestick token", () => {
    expect(CandlestickSeries.id).toBe("candlestick");
    expect(CandlestickSeries.meta.license).toBe("free");
  });

  it("builds typed errors", () => {
    const error = new WickError("INVALID_DATA", "bad bar");
    expect(isWickError(error)).toBe(true);
    expect(error.code).toBe("INVALID_DATA");
  });

  it("enforces licensing", () => {
    expect(() => assertFeature({ hasFeature: () => false }, "orderflow")).toThrow(/does not grant/);
  });
});
