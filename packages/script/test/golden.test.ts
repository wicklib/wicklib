import { readFileSync } from "node:fs";
import type { OhlcData } from "@wicklib/core";
import { describe, expect, it } from "vitest";

import { ScriptSandbox } from "../src/sandbox";

interface GoldenFixture {
  source: string;
  bars: Array<[number, number, number, number, number]>;
  expected: Record<string, Array<number | null>>;
}

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/ta-golden.json", import.meta.url), "utf8"),
) as GoldenFixture;

const bars: OhlcData[] = fixture.bars.map(([time, open, high, low, close]) => ({
  time,
  open,
  high,
  low,
  close,
}));

describe("golden scripts", () => {
  it("matches the committed ta plot arrays", async () => {
    const sandbox = await ScriptSandbox.create(fixture.source);
    try {
      const result = sandbox.run(bars);
      for (const [id, expected] of Object.entries(fixture.expected)) {
        const actual = result.plots[id] ?? [];
        expect(actual).toHaveLength(expected.length);
        for (let index = 0; index < expected.length; index += 1) {
          const expectedValue = expected[index] ?? null;
          const actualValue = actual[index] ?? null;
          if (expectedValue === null || actualValue === null) {
            expect(actualValue).toBe(expectedValue);
          } else {
            expect(actualValue).toBeCloseTo(expectedValue, 8);
          }
        }
      }
    } finally {
      sandbox.dispose();
    }
  });
});
