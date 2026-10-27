import type { OhlcData } from "@wicklib/core";
import { describe, expect, it } from "vitest";

import { ScriptSandbox } from "../src/sandbox";

const source = `// @wicklib/api 1
import { defineScript, ta } from "@wicklib/script";
export default defineScript({
  inputs: {},
  plots: [
    { id: "vwma", title: "VWMA", type: "line" },
    { id: "tr", title: "TR", type: "line" },
    { id: "obv", title: "OBV", type: "line" },
    { id: "linreg", title: "LinReg", type: "line" },
    { id: "since", title: "Since", type: "line" },
  ],
  onBar(ctx) {
    ctx.plot("vwma", ta.vwma(ctx, "close", 3));
    ctx.plot("tr", ta.tr(ctx));
    ctx.plot("obv", ta.obv(ctx));
    ctx.plot("linreg", ta.linreg(ctx, "close", 3));
    ctx.plot("since", ta.barssince(ctx, ctx.bar.close === 3, "close-3"));
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
    volume: (index + 1) * 10,
  };
}

const bars: OhlcData[] = [1, 2, 3, 3, 4, 5].map(bar);

describe("extended ta built-ins", () => {
  it("computes vwma, tr, obv, linreg, and barssince", async () => {
    const sandbox = await ScriptSandbox.create(source);
    try {
      const result = sandbox.run(bars);
      expect(result.plots.vwma?.slice(0, 2)).toEqual([null, null]);
      expect(result.plots.vwma?.[2]).toBeCloseTo((1 * 10 + 2 * 20 + 3 * 30) / 60, 8);
      expect(result.plots.vwma?.[3]).toBeCloseTo((2 * 20 + 3 * 30 + 3 * 40) / 90, 8);
      expect(result.plots.tr).toEqual([2, 2, 2, 2, 2, 2]);
      expect(result.plots.obv).toEqual([0, 20, 50, 50, 100, 160]);
      expect(result.plots.linreg?.slice(0, 3)).toEqual([null, null, 3]);
      expect(result.plots.linreg?.[3]).toBeCloseTo(3.1666666667, 8);
      expect(result.plots.linreg?.[4]).toBeCloseTo(3.8333333333, 8);
      expect(result.plots.linreg?.[5]).toBe(5);
      expect(result.plots.since).toEqual([null, null, 0, 0, 1, 2]);
    } finally {
      sandbox.dispose();
    }
  });
});
