import { describe, expect, it } from "vitest";

import { constrainPointAngle, dragAngleReference, placementAngleReference } from "../src/chart";

describe("shift angle snapping", () => {
  it("snaps to 45-degree increments without changing length", () => {
    const snapped = constrainPointAngle({ x: 0, y: 0 }, { x: 100, y: 51 });
    expect(snapped.x).toBeCloseTo(snapped.y, 8);
    expect(Math.hypot(snapped.x, snapped.y)).toBeCloseTo(Math.hypot(100, 51), 8);

    const horizontal = constrainPointAngle({ x: 20, y: 20 }, { x: 120, y: 35 });
    expect(horizontal.y).toBeCloseTo(20, 8);
  });

  it("applies to line, channel, pitchfork, and disjoint channel tools", () => {
    for (const toolId of [
      "trend-line",
      "ray",
      "extended-line",
      "arrow",
      "trend-angle",
      "gann-fan",
      "measure",
      "stats-line",
      "parallel-channel",
      "fib-channel",
      "flat-top-bottom",
      "speed-lines",
      "pitchfork",
      "schiff-pitchfork",
      "modified-schiff-pitchfork",
    ]) {
      expect(placementAngleReference(toolId, 1)).toBe(0);
      expect(dragAngleReference(toolId, 0)).toBe(1);
      expect(dragAngleReference(toolId, 1)).toBe(0);
    }

    expect(placementAngleReference("disjoint-channel", 1)).toBe(0);
    expect(placementAngleReference("disjoint-channel", 3)).toBe(2);
    expect(dragAngleReference("disjoint-channel", 2)).toBe(3);
    expect(dragAngleReference("disjoint-channel", 3)).toBe(2);
    expect(placementAngleReference("trend-line", 0)).toBeNull();
    expect(placementAngleReference("rectangle", 1)).toBeNull();
  });
});
