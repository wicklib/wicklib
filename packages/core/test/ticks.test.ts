import { describe, expect, it } from "vitest";

import { formatTimeLabel, generateTimeTicks } from "../src/scale/ticks";

const DAY = 24 * 60 * 60_000;

describe("time ticks", () => {
  it("uses unique monthly labels for a one-year range", () => {
    const from = Date.UTC(2025, 0, 1);
    const to = Date.UTC(2025, 11, 31, 23, 59);
    const ticks = generateTimeTicks(from, to, 1136);

    expect(ticks).toHaveLength(12);
    expect(ticks[0]).toBe(from);

    const labels = ticks.map((time) =>
      formatTimeLabel(time, to - from, "en-US", "UTC", true, false),
    );
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels[0]).toBe("Jan 2025");
    expect(labels.at(-1)).toBe("Dec 2025");
  });

  it("keeps weekly ticks for shorter ranges", () => {
    const from = Date.UTC(2025, 0, 1);
    const to = from + 70 * DAY;
    const ticks = generateTimeTicks(from, to, 1136);

    expect(ticks.length).toBeGreaterThan(5);
    expect(ticks[1]! - ticks[0]!).toBe(7 * DAY);
    expect(new Date(ticks[0]!).getUTCDay()).toBe(1);
  });
});
