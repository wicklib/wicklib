import { describe, expect, it } from "vitest";

import { drawingToolSettings, parallelLines } from "../src/drawings";

describe("drawing settings", () => {
  it("exposes only the settings relevant to each tool", () => {
    const elliott = drawingToolSettings("elliott-impulse");
    expect(elliott).toContain("showLabels");
    expect(elliott).not.toContain("text");
    expect(elliott).not.toContain("fontSize");
    expect(elliott).not.toContain("fillColor");

    const text = drawingToolSettings("text");
    expect(text).toContain("text");
    expect(text).toContain("fontSize");
    expect(text).not.toContain("lineWidth");
    expect(text).not.toContain("fillOpacity");

    expect(drawingToolSettings("rectangle")).toContain("fillColor");
    expect(drawingToolSettings("horizontal-line")).not.toContain("fillOpacity");
    expect(() => drawingToolSettings("missing")).toThrow(/Unknown drawing tool/);
  });
});

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
