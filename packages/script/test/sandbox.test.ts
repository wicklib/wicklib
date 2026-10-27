import type { OhlcData } from "@wicklib/core";
import { describe, expect, it } from "vitest";

import { ScriptSandbox } from "../src/sandbox";
import { ScriptRuntimeError } from "../src/runtime-errors";

const HEADER = "// @wicklib/api 1";
const MINUTE = 60_000;

function script(onBar: string): string {
  return `${HEADER}
import { defineScript } from "@wicklib/script";

export default defineScript({
  inputs: { offset: { type: "number", defaultValue: 5 } },
  plots: [{ id: "line", title: "Line", type: "line" }],
  onBar(ctx) {
    ${onBar}
  },
});
`;
}

const bars: OhlcData[] = [1, 2, 3].map((close, index) => ({
  time: index * MINUTE,
  open: close,
  high: close + 1,
  low: close - 1,
  close,
}));

describe("ScriptSandbox", () => {
  it("runs bars in order with inputs, state, plots, and alerts", async () => {
    const sandbox = await ScriptSandbox.create(
      script(`
        const count = (ctx.state.get("count") ?? 0) + 1;
        ctx.state.set("count", count);
        ctx.plot("line", ctx.bar.close + ctx.inputs.offset + count);
        if (ctx.index === 1) ctx.alert("second bar");
      `),
    );

    try {
      const result = sandbox.run(bars);
      expect(result.plots.line).toEqual([7, 9, 11]);
      expect(result.alerts).toEqual(["second bar"]);
    } finally {
      sandbox.dispose();
      sandbox.dispose();
    }
  });

  it("rejects undeclared plot ids at runtime", async () => {
    const sandbox = await ScriptSandbox.create(script('ctx.plot("missing", 1);'));
    try {
      expect(() => sandbox.run(bars)).toThrowError(/not declared/);
    } finally {
      sandbox.dispose();
    }
  });

  it("enforces the wall-clock limit", async () => {
    const sandbox = await ScriptSandbox.create(
      script("while (true) {}"),
      {},
      {
        timeLimitMs: 20,
      },
    );
    try {
      expect(() => sandbox.run(bars)).toThrowError(ScriptRuntimeError);
      try {
        sandbox.run(bars);
      } catch (error) {
        expect((error as ScriptRuntimeError).code).toBe("TIMEOUT");
      }
    } finally {
      sandbox.dispose();
    }
  });

  it("enforces output caps", async () => {
    const sandbox = await ScriptSandbox.create(
      script('for (let i = 0; i < 20; i += 1) ctx.alert("x");'),
      {},
      { maxAlertsPerBar: 3 },
    );
    try {
      expect(() => sandbox.run(bars)).toThrowError(/Alert limit/);
    } finally {
      sandbox.dispose();
    }
  });
});
