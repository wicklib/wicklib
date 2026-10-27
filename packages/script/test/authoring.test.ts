import { describe, expect, it } from "vitest";

import { ScriptError, defineScript } from "../src/index";

describe("defineScript", () => {
  it("infers input values and plot ids", () => {
    const script = defineScript({
      name: "Close plot",
      inputs: {
        period: {
          type: "number",
          title: "Period",
          defaultValue: 14,
          min: 1,
        },
        enabled: { type: "boolean", defaultValue: true },
      },
      plots: [{ id: "line", title: "Line", type: "line" }],
      onBar(context) {
        const period: number = context.inputs.period;
        const enabled: boolean = context.inputs.enabled;
        if (enabled) {
          context.plot("line", context.bar.close + period);
        }
        // @ts-expect-error plot ids are inferred from the definition
        context.plot("missing", 0);
      },
    });

    expect(Object.isFrozen(script)).toBe(true);
    expect(Object.isFrozen(script.plots)).toBe(true);
    expect(script.plots[0]?.id).toBe("line");
  });

  it("rejects duplicate plot ids", () => {
    expect(() =>
      defineScript({
        inputs: {},
        plots: [
          { id: "line", title: "Line", type: "line" },
          { id: "line", title: "Line 2", type: "line" },
        ],
        onBar() {
          // no-op
        },
      }),
    ).toThrowError(ScriptError);
  });
});
