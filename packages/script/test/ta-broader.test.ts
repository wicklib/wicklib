import type { OhlcData } from "@wicklib/core";
import { describe, expect, it } from "vitest";

import { ScriptSandbox } from "../src/sandbox";

const source = `// @wicklib/api 1
import { defineScript, ta } from "@wicklib/script";
export default defineScript({
  inputs: {},
  plots: [
    { id: "wma", title: "WMA", type: "line" },
    { id: "rma", title: "RMA", type: "line" },
    { id: "cci", title: "CCI", type: "line" },
    { id: "mfi", title: "MFI", type: "line" },
    { id: "wpr", title: "WPR", type: "line" },
  ],
  onBar(ctx) {
    ctx.plot("wma", ta.wma(ctx, "close", 3));
    ctx.plot("rma", ta.rma(ctx, "close", 3));
    ctx.plot("cci", ta.cci(ctx, "close", 3));
    ctx.plot("mfi", ta.mfi(ctx, 2));
    ctx.plot("wpr", ta.wpr(ctx, 3));
  },
});
`;

function bar(close: number, index: number): OhlcData {
  return {
    time: index * 60_000,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 10,
  };
}

const bars = [1, 2, 3, 4, 5, 6].map(bar);

describe("broader ta built-ins", () => {
  it("computes wma, rma, cci, mfi, and wpr", async () => {
    const sandbox = await ScriptSandbox.create(source);
    try {
      const result = sandbox.run(bars);
      expect(result.plots.wma?.slice(0, 2)).toEqual([null, null]);
      expect(result.plots.wma?.[2]).toBeCloseTo(14 / 6, 8);
      expect(result.plots.wma?.[5]).toBeCloseTo(32 / 6, 8);
      expect(result.plots.rma?.slice(0, 2)).toEqual([null, null]);
      expect(result.plots.rma?.[2]).toBe(2);
      expect(result.plots.rma?.[3]).toBeCloseTo(8 / 3, 8);
      expect(result.plots.rma?.[5]).toBeCloseTo(116 / 27, 8);
      expect(result.plots.cci?.[2]).toBeCloseTo(100, 8);
      expect(result.plots.mfi?.[2]).toBe(100);
      expect(result.plots.wpr?.[2]).toBe(-25);
      expect(result.plots.wpr?.[5]).toBe(-25);
    } finally {
      sandbox.dispose();
    }
  });

  it("reports bars since the highest and lowest values", async () => {
    const extremeSource = `// @wicklib/api 1
import { defineScript, ta } from "@wicklib/script";
export default defineScript({
  inputs: {},
  plots: [
    { id: "high", title: "High bars", type: "line" },
    { id: "low", title: "Low bars", type: "line" },
  ],
  onBar(ctx) {
    ctx.plot("high", ta.highestbars(ctx, "close", 3));
    ctx.plot("low", ta.lowestbars(ctx, "close", 3));
  },
});
`;
    const extremeBars = [1, 5, 3, 4, 2, 6].map(bar);
    const sandbox = await ScriptSandbox.create(extremeSource);
    try {
      const result = sandbox.run(extremeBars);
      expect(result.plots.high).toEqual([null, null, 1, 2, 1, 0]);
      expect(result.plots.low).toEqual([null, null, 2, 1, 0, 1]);
    } finally {
      sandbox.dispose();
    }
  });

  it("computes money flow from rising and falling typical prices", async () => {
    const mfiSource = `// @wicklib/api 1
import { defineScript, ta } from "@wicklib/script";
export default defineScript({
  inputs: {},
  plots: [{ id: "mfi", title: "MFI", type: "line" }],
  onBar(ctx) {
    ctx.plot("mfi", ta.mfi(ctx, 2));
  },
});
`;
    const flat = [1, 2, 1, 3].map((close, index) => ({
      time: index * 60_000,
      open: close,
      high: close,
      low: close,
      close,
      volume: 10,
    }));
    const sandbox = await ScriptSandbox.create(mfiSource);
    try {
      const result = sandbox.run(flat);
      expect(result.plots.mfi?.[2]).toBeCloseTo(66.6666666667, 8);
      expect(result.plots.mfi?.[3]).toBeCloseTo(75, 8);
    } finally {
      sandbox.dispose();
    }
  });
});
