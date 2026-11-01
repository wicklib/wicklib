import { describe, expect, it } from "vitest";

import { parallelLines } from "../src/drawings";

describe("drawing geometry", () => {
  it("bounds parallel channels to the anchor range", () => {
    const lines = parallelLines([
      { x: 100, y: 100 },
      { x: 200, y: 140 },
      { x: 150, y: 120 },
    ]);
    expect(lines[0][0].x).toBe(100);
    expect(lines[0][1].x).toBe(200);
    expect(lines[1][0].x).toBe(100);
    expect(lines[1][1].x).toBe(200);
    expect(lines[0][0].y).toBe(100);
    expect(lines[0][1].y).toBe(140);
  });
});
