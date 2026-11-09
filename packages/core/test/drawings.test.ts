import { describe, expect, it } from "vitest";

import {
  DRAWING_TOOL_CATALOG,
  drawingToolSettings,
  elliottLabelPlacement,
  hitTestDrawing,
  mergeDrawingOptions,
  parallelLines,
  resolveDrawingOptions,
  type ResolvedDrawingOptions,
} from "../src/drawings";

describe("drawing catalog", () => {
  it("groups and describes every built-in tool", () => {
    const ids = DRAWING_TOOL_CATALOG.map((entry) => entry.definition.id);
    expect(ids).toContain("trend-line");
    expect(ids).toContain("elliott-impulse");
    expect(ids).toContain("brush");
    expect(ids).toContain("text");
    expect(ids).toContain("ray");
    expect(ids).toContain("extended-line");
    expect(ids).toContain("trend-angle");
    expect(ids).toContain("arrow");
    expect(ids).toContain("stats-line");
    expect(ids).toContain("regression-trend");
    expect(ids).toContain("flat-top-bottom");
    expect(ids).toContain("disjoint-channel");
    expect(ids).toContain("fib-channel");
    expect(ids).toContain("fib-time-zone");
    expect(ids).toContain("pitchfork");
    expect(ids).toContain("schiff-pitchfork");
    expect(ids).toContain("modified-schiff-pitchfork");
    expect(ids).toContain("gann-fan");
    expect(ids).toContain("speed-lines");

    const elliott = DRAWING_TOOL_CATALOG.find(
      (entry) => entry.definition.id === "elliott-triple-combo",
    );
    expect(elliott?.category).toBe("patterns");
    expect(elliott?.settings).not.toContain("text");

    const text = DRAWING_TOOL_CATALOG.find((entry) => entry.definition.id === "text");
    expect(text?.category).toBe("text");
    expect(text?.settings).toContain("fontSize");

    const stats = DRAWING_TOOL_CATALOG.find((entry) => entry.definition.id === "stats-line");
    expect(stats?.category).toBe("measurement");
    expect(stats?.definition.persist).not.toBe(false);
    const measure = DRAWING_TOOL_CATALOG.find((entry) => entry.definition.id === "measure");
    expect(measure?.definition.persist).toBe(false);

    const fibChannel = DRAWING_TOOL_CATALOG.find((entry) => entry.definition.id === "fib-channel");
    expect(fibChannel?.category).toBe("channels");
    expect(fibChannel?.settings).toContain("showLabels");

    const fibTime = DRAWING_TOOL_CATALOG.find((entry) => entry.definition.id === "fib-time-zone");
    expect(fibTime?.category).toBe("fibonacci");
    expect(fibTime?.settings).toContain("showLabels");
    const pitchfork = DRAWING_TOOL_CATALOG.find((entry) => entry.definition.id === "pitchfork");
    expect(pitchfork?.category).toBe("channels");
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
    expect(drawingToolSettings("ray")).not.toContain("fillOpacity");
    expect(drawingToolSettings("trend-angle")).toContain("showLabels");
    expect(drawingToolSettings("stats-line")).toContain("showLabels");
    expect(drawingToolSettings("regression-trend")).toContain("fillOpacity");
    expect(drawingToolSettings("flat-top-bottom")).not.toContain("showLabels");
    expect(drawingToolSettings("fib-channel")).toContain("showLabels");
    expect(drawingToolSettings("fib-time-zone")).toContain("showLabels");
    expect(drawingToolSettings("pitchfork")).not.toContain("showLabels");
    expect(drawingToolSettings("gann-fan")).toContain("showLabels");
    expect(drawingToolSettings("speed-lines")).not.toContain("showLabels");
    expect(drawingToolSettings("elliott-impulse")).toContain("labelPlacement");
    expect(drawingToolSettings("elliott-impulse")).toContain("labelFontSize");
    expect(drawingToolSettings("elliott-impulse")).toContain("labelBackgroundVisible");
    expect(drawingToolSettings("elliott-impulse")).toContain("showLine");
    expect(drawingToolSettings("elliott-impulse")).toContain("stats");
    expect(drawingToolSettings("fib-channel")).toContain("labelFontSize");
    expect(drawingToolSettings("trend-line")).toContain("extendLeft");
    expect(drawingToolSettings("trend-line")).toContain("priceLabels");
    expect(drawingToolSettings("trend-line")).toContain("statsPosition");
    expect(drawingToolSettings("trend-line")).toContain("statsFields");
    expect(drawingToolSettings("elliott-impulse")).toContain("statsFields");
    expect(drawingToolSettings("long-position")).toContain("stopColor");
    expect(drawingToolSettings("short-position")).toContain("targetColor");
    expect(drawingToolSettings("long-position")).toContain("labelTextColor");
    expect(drawingToolSettings("long-position")).toContain("statsPosition");
    expect(drawingToolSettings("long-position")).not.toContain("statsFields");
    expect(drawingToolSettings("price-range")).toContain("extendTop");
    expect(drawingToolSettings("time-range")).toContain("extendBottom");
    expect(drawingToolSettings("price-date-range")).toContain("fillOpacity");
    expect(() => drawingToolSettings("missing")).toThrow(/Unknown drawing tool/);
  });
});

describe("drawing labels", () => {
  it("accepts string label overrides and rejects invalid values", () => {
    const resolved = resolveDrawingOptions(undefined, {
      labels: ["0", "i", "ii", "iii", "iv", "v"],
    });
    expect(resolved.labels).toEqual(["0", "i", "ii", "iii", "iv", "v"]);
    expect(() => resolveDrawingOptions(undefined, { labels: ["0", 1 as never] })).toThrow(/labels/);
  });

  it("resolves per-drawing label styling", () => {
    const resolved = resolveDrawingOptions(undefined, {
      labelPlacement: "above",
      labelFontSize: 24,
      labelBackgroundVisible: false,
    });
    expect(resolved.labelPlacement).toBe("above");
    expect(resolved.labelFontSize).toBe(24);
    expect(resolved.labelBackgroundVisible).toBe(false);
    expect(() => resolveDrawingOptions(undefined, { labelFontSize: 0 })).toThrow(/labelFontSize/);
    expect(() => resolveDrawingOptions(undefined, { labelPlacement: "right" as never })).toThrow(
      /labelPlacement/,
    );
  });

  it("normalizes theme colors and clears overrides", () => {
    const resolved = resolveDrawingOptions(undefined, {
      color: "",
      fillColor: null,
      textColor: "theme",
      showLine: false,
      extendLeft: true,
      extendRight: true,
      showMidpoint: true,
      priceLabels: "always",
      stats: "selected",
      statsFields: ["timeRange", "range", "timeRange"],
      statsPosition: "right",
      textStyle: "bold-italic",
      textAlign: "right",
      textVerticalAlign: "bottom",
    });
    expect(resolved.color).toBe("theme");
    expect(resolved.fillColor).toBe("theme");
    expect(resolved.textColor).toBe("theme");
    expect(resolved.showLine).toBe(false);
    expect(resolved.extendLeft).toBe(true);
    expect(resolved.showMidpoint).toBe(true);
    expect(resolved.priceLabels).toBe("always");
    expect(resolved.stats).toBe("selected");
    expect(resolved.statsFields).toEqual(["timeRange", "range"]);
    expect(resolved.statsPosition).toBe("right");
    expect(resolved.textStyle).toBe("bold-italic");
    expect(resolved.textAlign).toBe("right");
    expect(resolved.textVerticalAlign).toBe("bottom");

    const base = resolveDrawingOptions(undefined, { color: "#ffffff" });
    expect(mergeDrawingOptions(base, { color: null }).color).toBe("theme");
    expect(resolveDrawingOptions(undefined, {}).statsFields).toEqual([
      "range",
      "change",
      "bars",
      "date",
      "angle",
    ]);
    expect(() => resolveDrawingOptions(undefined, { statsFields: ["unknown" as never] })).toThrow(
      /statsFields/,
    );
  });
});

describe("Elliott label placement", () => {
  const patterns: Record<string, Array<{ x: number; y: number }>> = {
    "elliott-impulse": [
      { x: 0, y: 100 },
      { x: 10, y: 50 },
      { x: 20, y: 80 },
      { x: 30, y: 30 },
      { x: 40, y: 70 },
      { x: 50, y: 20 },
    ],
    "elliott-correction": [
      { x: 0, y: 100 },
      { x: 10, y: 50 },
      { x: 20, y: 80 },
      { x: 30, y: 30 },
    ],
    "elliott-triangle": [
      { x: 0, y: 100 },
      { x: 10, y: 50 },
      { x: 20, y: 80 },
      { x: 30, y: 30 },
      { x: 40, y: 70 },
      { x: 50, y: 20 },
    ],
    "elliott-double-combo": [
      { x: 0, y: 100 },
      { x: 10, y: 50 },
      { x: 20, y: 80 },
      { x: 30, y: 30 },
    ],
    "elliott-triple-combo": [
      { x: 0, y: 100 },
      { x: 10, y: 50 },
      { x: 20, y: 80 },
      { x: 30, y: 30 },
      { x: 40, y: 70 },
      { x: 50, y: 20 },
    ],
  };

  for (const [toolId, points] of Object.entries(patterns)) {
    it(`places ${toolId} labels above highs and below lows`, () => {
      for (let index = 0; index < points.length; index += 1) {
        const expected = index % 2 === 0 ? "below" : "above";
        expect(elliottLabelPlacement(points, index, "auto")).toBe(expected);
      }
      expect(elliottLabelPlacement(points, 2, "above")).toBe("above");
      expect(elliottLabelPlacement(points, 2, "below")).toBe("below");
    });
  }
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

describe("line drawing hit testing", () => {
  const options: ResolvedDrawingOptions = resolveDrawingOptions(undefined, {
    color: "#ffffff",
  });
  const pane = {
    plot: { left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300 },
    priceScale: {
      priceToY: (price: number) => 300 - price,
      yToPrice: (y: number) => 300 - y,
    },
  };
  const timeScale = {
    timeToX: (time: number) => time,
    timeAtX: (x: number) => x,
  };
  const target = (toolId: string) => ({
    toolId,
    anchors: [
      { time: 100, price: 100 },
      { time: 200, price: 200 },
    ],
    options,
  });

  it("limits rays to the forward direction", () => {
    expect(hitTestDrawing(target("ray"), { x: 300, y: 0 }, pane, timeScale)).toBe(true);
    expect(hitTestDrawing(target("ray"), { x: 0, y: 300 }, pane, timeScale)).toBe(false);
  });

  it("extends extended lines in both directions", () => {
    expect(hitTestDrawing(target("extended-line"), { x: 0, y: 300 }, pane, timeScale)).toBe(true);
    expect(hitTestDrawing(target("extended-line"), { x: 300, y: 0 }, pane, timeScale)).toBe(true);
  });

  it("hit-tests angle, arrow, and stats line segments", () => {
    for (const toolId of ["trend-angle", "arrow", "stats-line"]) {
      expect(hitTestDrawing(target(toolId), { x: 150, y: 150 }, pane, timeScale)).toBe(true);
    }
  });

  const channelTarget = (toolId: string) => ({
    toolId,
    anchors: [
      { time: 100, price: 100 },
      { time: 200, price: 200 },
      { time: 150, price: 50 },
    ],
    options,
  });

  it("hit-tests flat and fib channels", () => {
    for (const toolId of ["flat-top-bottom", "fib-channel"]) {
      expect(hitTestDrawing(channelTarget(toolId), { x: 150, y: 150 }, pane, timeScale)).toBe(true);
    }
    expect(
      hitTestDrawing(channelTarget("flat-top-bottom"), { x: 150, y: 250 }, pane, timeScale),
    ).toBe(true);
  });

  it("hit-tests four-anchor disjoint channels", () => {
    const target = {
      toolId: "disjoint-channel",
      anchors: [
        { time: 100, price: 100 },
        { time: 200, price: 200 },
        { time: 120, price: 50 },
        { time: 220, price: 150 },
      ],
      options,
    };
    expect(hitTestDrawing(target, { x: 150, y: 150 }, pane, timeScale)).toBe(true);
    expect(hitTestDrawing(target, { x: 150, y: 220 }, pane, timeScale)).toBe(true);
  });

  it("hit-tests Fib time zones and pitchforks", () => {
    expect(hitTestDrawing(target("fib-time-zone"), { x: 200, y: 150 }, pane, timeScale)).toBe(true);
    expect(hitTestDrawing(target("fib-time-zone"), { x: 250, y: 150 }, pane, timeScale)).toBe(
      false,
    );

    const three = {
      toolId: "pitchfork",
      anchors: [
        { time: 100, price: 100 },
        { time: 200, price: 200 },
        { time: 150, price: 50 },
      ],
      options,
    };
    for (const toolId of ["pitchfork", "schiff-pitchfork", "modified-schiff-pitchfork"]) {
      expect(hitTestDrawing({ ...three, toolId }, { x: 200, y: 100 }, pane, timeScale)).toBe(true);
    }

    expect(hitTestDrawing(target("gann-fan"), { x: 150, y: 150 }, pane, timeScale)).toBe(true);
    expect(
      hitTestDrawing({ ...three, toolId: "speed-lines" }, { x: 150, y: 150 }, pane, timeScale),
    ).toBe(true);
  });

  it("uses the anchor line as the regression selection proxy", () => {
    expect(hitTestDrawing(target("regression-trend"), { x: 150, y: 150 }, pane, timeScale)).toBe(
      true,
    );
  });
});
