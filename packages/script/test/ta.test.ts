import type { OhlcData } from "@wicklib/core";
import { describe, expect, it } from "vitest";

import { ScriptSandbox } from "../src/sandbox";

const source = `// @wicklib/api 1
import { defineScript, ta } from "@wicklib/script";

export default defineScript({
  inputs: {},
  plots: [
    { id: "sma", title: "SMA", type: "line" },
    { id: "ema", title: "EMA", type: "line" },
    { id: "rsi", title: "RSI", type: "line" },
    { id: "atr", title: "ATR", type: "line" },
    { id: "highest", title: "Highest", type: "line" },
    { id: "lowest", title: "Lowest", type: "line" },
  ],
  onBar(ctx) {
    ctx.plot("sma", ta.sma(ctx, "close", 3));
    ctx.plot("ema", ta.ema(ctx, "close", 3));
    ctx.plot("rsi", ta.rsi(ctx, "close", 2));
    ctx.plot("atr", ta.atr(ctx, 2));
    ctx.plot("highest", ta.highest(ctx, "high", 3));
    ctx.plot("lowest", ta.lowest(ctx, "low", 3));
  },
});
`;

const bars: OhlcData[] = [1, 2, 3, 4, 5, 6].map((close, index) => ({
  time: index * 60_000,
  open: close,
  high: close + 1,
  low: close - 1,
  close,
}));

describe("ta built-ins", () => {
  it("computes deterministic rolling values", async () => {
    const sandbox = await ScriptSandbox.create(source);
    try {
      const result = sandbox.run(bars);
      expect(result.plots.sma).toEqual([null, null, 2, 3, 4, 5]);
      expect(result.plots.ema).toEqual([null, null, 2, 3, 4, 5]);
      expect(result.plots.rsi).toEqual([null, null, 100, 100, 100, 100]);
      expect(result.plots.atr).toEqual([null, 2, 2, 2, 2, 2]);
      expect(result.plots.highest).toEqual([null, null, 4, 5, 6, 7]);
      expect(result.plots.lowest).toEqual([null, null, 0, 1, 2, 3]);
    } finally {
      sandbox.dispose();
    }
  });

  it("supports crossover and crossunder", async () => {
    const crossoverSource = source.replace(
      `    ctx.plot("sma", ta.sma(ctx, "close", 3));
    ctx.plot("ema", ta.ema(ctx, "close", 3));
    ctx.plot("rsi", ta.rsi(ctx, "close", 2));
    ctx.plot("atr", ta.atr(ctx, 2));
    ctx.plot("highest", ta.highest(ctx, "high", 3));
    ctx.plot("lowest", ta.lowest(ctx, "low", 3));`,
      `    ctx.plot("sma", ta.crossover(ctx, "close", 3) ? 1 : 0);
    ctx.plot("ema", ta.crossunder(ctx, "close", 3) ? 1 : 0);
    ctx.plot("rsi", null);
    ctx.plot("atr", null);
    ctx.plot("highest", null);
    ctx.plot("lowest", null);`,
    );
    const sandbox = await ScriptSandbox.create(crossoverSource);
    try {
      const result = sandbox.run(bars);
      expect(result.plots.sma).toEqual([0, 0, 0, 1, 0, 0]);
      expect(result.plots.ema).toEqual([0, 0, 0, 0, 0, 0]);
    } finally {
      sandbox.dispose();
    }
  });
});
