import { describe, expect, it } from "vitest";

import {
  DRAWING_TOOL_CATALOG,
  drawingToolSettings,
  hitTestDrawing,
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
  const options: ResolvedDrawingOptions = {
    color: "#ffffff",
    lineWidth: 1,
    lineStyle: "solid",
    fillColor: "#ffffff",
    fillOpacity: 0.12,
    showLabels: true,
    text: "",
    fontSize: 13,
    locked: false,
    visible: true,
  };
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
