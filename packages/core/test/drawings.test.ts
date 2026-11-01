import { describe, expect, it } from "vitest";

import { DRAWING_TOOL_CATALOG, drawingToolSettings, parallelLines } from "../src/drawings";

describe("drawing catalog", () => {
  it("groups and describes every built-in tool", () => {
    const ids = DRAWING_TOOL_CATALOG.map((entry) => entry.definition.id);
    expect(ids).toContain("trend-line");
    expect(ids).toContain("elliott-impulse");
    expect(ids).toContain("brush");
    expect(ids).toContain("text");

    const elliott = DRAWING_TOOL_CATALOG.find(
      (entry) => entry.definition.id === "elliott-triple-combo",
    );
    expect(elliott?.category).toBe("patterns");
    expect(elliott?.settings).not.toContain("text");

    const text = DRAWING_TOOL_CATALOG.find((entry) => entry.definition.id === "text");
    expect(text?.category).toBe("text");
    expect(text?.settings).toContain("fontSize");
  });
});

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
