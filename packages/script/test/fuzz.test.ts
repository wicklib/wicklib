import type { OhlcData } from "@wicklib/core";
import { describe, expect, it } from "vitest";

import { compileSource } from "../src/compiler";
import { ScriptError } from "../src/errors";
import { ScriptSandbox } from "../src/sandbox";

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const source = `// @wicklib/api 1
import { defineScript, ta } from "@wicklib/script";
export default defineScript({
  inputs: {},
  plots: [{ id: "line", title: "Line", type: "line" }],
  onBar(ctx) { ctx.plot("line", ta.sma(ctx, "close", 5)); },
});
`;

describe("fuzz", () => {
  it("never throws non-ScriptError from random compiler input", () => {
    const next = random(11);
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789{}[]();:,.=+*/@#\\n\\\"'` ";
    for (let iteration = 0; iteration < 250; iteration += 1) {
      let input = "";
      const length = Math.floor(next() * 120);
      for (let index = 0; index < length; index += 1) {
        input += alphabet[Math.floor(next() * alphabet.length)];
      }
      try {
        compileSource(input);
      } catch (error) {
        expect(error).toBeInstanceOf(ScriptError);
      }
    }
  });

  it("produces deterministic ta output for random bars", async () => {
    const next = random(29);
    const bars: OhlcData[] = [];
    let price = 100;
    for (let index = 0; index < 40; index += 1) {
      const open = price;
      const close = Math.max(1, open + (next() - 0.5) * 4);
      const high = Math.max(open, close) + next();
      const low = Math.min(open, close) - next();
      bars.push({ time: index * 60_000, open, high, low, close });
      price = close;
    }

    const first = await ScriptSandbox.create(source);
    const second = await ScriptSandbox.create(source);
    try {
      const a = first.run(bars);
      const b = second.run(bars);
      expect(a).toEqual(b);
      expect(a.plots.line).toHaveLength(bars.length);
      expect(a.plots.line?.slice(0, 4)).toEqual([null, null, null, null]);
    } finally {
      first.dispose();
      second.dispose();
    }
  });
});
