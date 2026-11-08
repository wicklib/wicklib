import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  CandlestickSeries,
  ElliottCorrection,
  ElliottDoubleCombo,
  ElliottImpulse,
  ElliottTriangle,
  ElliottTripleCombo,
  TrendLine,
  createChart,
  type ChartApi,
  type OhlcData,
} from "../src/index";

const MINUTE = 60_000;
const charts: ChartApi[] = [];
const containers: HTMLElement[] = [];
const textCalls: Array<{
  text: string;
  x: number;
  y: number;
  font: string;
  fillStyle: string;
  textAlign: string;
  textBaseline: string;
}> = [];
const fillStyles: string[] = [];
const fillRects: Array<{ x: number; y: number; width: number; height: number; fillStyle: string }> =
  [];

function mount(): HTMLElement {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientWidth", { value: 800, configurable: true });
  Object.defineProperty(element, "clientHeight", { value: 400, configurable: true });
  document.body.appendChild(element);
  containers.push(element);
  return element;
}

function bars(count = 100): OhlcData[] {
  return Array.from({ length: count }, (_, index) => ({
    time: index * MINUTE,
    open: 100 + index,
    high: 102 + index,
    low: 98 + index,
    close: 100 + index,
  }));
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

beforeAll(() => {
  const target = {
    font: "12px sans-serif",
    fillStyle: "#000000",
    measureText: (text: string) => ({ width: text.length * 7 }),
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    textAlign: "left",
    textBaseline: "alphabetic",
    fillText(
      this: { font: string; fillStyle: string; textAlign: string; textBaseline: string },
      text: string,
      x: number,
      y: number,
    ) {
      textCalls.push({
        text: String(text),
        x,
        y,
        font: this.font,
        fillStyle: this.fillStyle,
        textAlign: this.textAlign,
        textBaseline: this.textBaseline,
      });
    },
    fillRect(this: { fillStyle: string }, x: number, y: number, width: number, height: number) {
      fillStyles.push(this.fillStyle);
      fillRects.push({ x, y, width, height, fillStyle: this.fillStyle });
    },
  } as Record<string, unknown>;
  const context = new Proxy(target, {
    get(current, property) {
      return property in current ? current[property as string] : () => undefined;
    },
    set(current, property, value) {
      current[property as string] = value;
      return true;
    },
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => context as unknown as CanvasRenderingContext2D,
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    return setTimeout(() => callback(performance.now()), 0) as unknown as number;
  });
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => clearTimeout(handle));

  class ResizeObserverStub {
    observe(): void {
      // no-op
    }
    unobserve(): void {
      // no-op
    }
    disconnect(): void {
      // no-op
    }
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach(() => {
  while (charts.length > 0) {
    try {
      charts.pop()?.destroy();
    } catch {
      // Already destroyed.
    }
  }
  while (containers.length > 0) {
    containers.pop()?.remove();
  }
  textCalls.length = 0;
  fillStyles.length = 0;
  fillRects.length = 0;
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("drawing label styling", () => {
  it("skips labels when Elliott anchors leave the visible price range", async () => {
    const chart = createChart(mount());
    charts.push(chart);
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars());
    chart.timeScale().fitContent();
    series.priceScale().setVisibleRange({ min: 500, max: 600 });

    const tools = [
      [ElliottImpulse, 6],
      [ElliottCorrection, 4],
      [ElliottTriangle, 6],
      [ElliottDoubleCombo, 4],
      [ElliottTripleCombo, 6],
    ] as const;
    for (const [tool, count] of tools) {
      chart.addDrawing(tool, {
        anchors: Array.from({ length: count }, (_, index) => ({
          time: index * 10 * MINUTE,
          price: 100 + index * 2,
        })),
        options: {
          labels: Array.from({ length: count }, (_, index) => `skip-${tool.id}-${index}`),
        },
      });
    }

    textCalls.length = 0;
    await settle();
    expect(textCalls.some((call) => call.text.startsWith("skip-"))).toBe(false);
  });

  it("renders theme colors, trend-line text, stats, and axis price labels", async () => {
    const chart = createChart(mount(), {
      layout: { textColor: "#abcdef", background: "#111111" },
    });
    charts.push(chart);
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars());
    series.priceScale().setOptions({ priceFormat: { precision: 2 } });
    chart.timeScale().fitContent();

    chart.addDrawing(TrendLine, {
      anchors: [
        { time: 0, price: 101.27 },
        { time: 50 * MINUTE, price: 123.73 },
      ],
      options: {
        color: "",
        text: "Trend",
        textColor: "",
        textStyle: "bold-italic",
        textAlign: "right",
        textVerticalAlign: "top",
        fontSize: 18,
        showMidpoint: true,
        priceLabels: "always",
        timeLabels: "always",
        stats: "always",
        statsPosition: "left",
      },
    });

    await settle();
    const trendText = textCalls.find((call) => call.text === "Trend");
    expect(trendText).toMatchObject({
      fillStyle: "#abcdef",
      textAlign: "left",
      textBaseline: "top",
    });
    expect(trendText?.font.includes("bold italic 18px")).toBe(true);
    expect(textCalls.some((call) => call.text.startsWith("Range  "))).toBe(true);
    expect(textCalls.some((call) => call.text === "101.27")).toBe(true);
    expect(textCalls.some((call) => call.text === "123.73")).toBe(true);
    expect(fillStyles).toContain("#abcdef");
    expect(
      textCalls.filter(
        (call) =>
          call.fillStyle === "#abcdef" &&
          call.textBaseline === "middle" &&
          call.text !== "101.27" &&
          call.text !== "123.73",
      ).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("uses per-drawing font size and supports boxless labels", async () => {
    const chart = createChart(mount());
    charts.push(chart);
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars());
    chart.timeScale().fitContent();

    const drawing = chart.addDrawing(ElliottImpulse, {
      anchors: [
        { time: 0, price: 100 },
        { time: 10 * MINUTE, price: 108 },
        { time: 20 * MINUTE, price: 103 },
        { time: 30 * MINUTE, price: 112 },
        { time: 40 * MINUTE, price: 109 },
        { time: 50 * MINUTE, price: 116 },
      ],
      options: {
        labels: ["0", "i", "ii", "iii", "iv", "v"],
        labelFontSize: 24,
        color: "#123456",
      },
    });

    await settle();
    const boxed = textCalls.find((call) => call.text === "ii");
    expect(boxed?.font.startsWith("24px")).toBe(true);
    expect(boxed?.fillStyle).toBe("#ffffff");
    expect(fillStyles).toContain("#123456");

    drawing.setOptions({ labelBackgroundVisible: false });
    textCalls.length = 0;
    fillStyles.length = 0;
    await settle();

    const boxless = textCalls.find((call) => call.text === "ii");
    expect(boxless?.font.startsWith("24px")).toBe(true);
    expect(boxless?.fillStyle).toBe("#123456");
    expect(fillStyles).not.toContain("#123456");
  });
  it("places trend text and stats relative to drawing endpoints", async () => {
    const chart = createChart(mount(), { layout: { background: "#111111" } });
    charts.push(chart);
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars());
    chart.timeScale().fitContent();

    const anchors = [
      { time: 20 * MINUTE, price: 120 },
      { time: 60 * MINUTE, price: 140 },
    ];
    for (const align of ["left", "center", "right"] as const) {
      chart.addDrawing(TrendLine, {
        anchors,
        options: {
          text: `Text-${align}`,
          textAlign: align,
          textVerticalAlign: "middle",
          stats: "off",
        },
      });
    }
    for (const position of ["left", "center", "right"] as const) {
      chart.addDrawing(TrendLine, {
        anchors,
        options: { stats: "always", statsPosition: position },
      });
    }

    await settle();
    const left = textCalls.find((call) => call.text === "Text-left");
    const center = textCalls.find((call) => call.text === "Text-center");
    const right = textCalls.find((call) => call.text === "Text-right");
    expect(left).toBeDefined();
    expect(center).toBeDefined();
    expect(right).toBeDefined();
    expect(left!.x).toBeLessThan(center!.x);
    expect(right!.x).toBeGreaterThan(center!.x);
    expect(left!.textAlign).toBe("right");
    expect(center!.textAlign).toBe("center");
    expect(right!.textAlign).toBe("left");

    const statsX = [
      ...new Set(
        fillRects.filter((rect) => rect.fillStyle === "rgba(17,24,39,0.94)").map((rect) => rect.x),
      ),
    ].sort((first, second) => first - second);
    expect(statsX).toHaveLength(3);
    expect(statsX[0]).toBeLessThan(statsX[1]!);
    expect(statsX[1]).toBeLessThan(statsX[2]!);
  });

  it("uses a light stats surface on light backgrounds", async () => {
    const chart = createChart(mount(), {
      layout: { background: "#ffffff", textColor: "#111827" },
    });
    charts.push(chart);
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars());
    chart.timeScale().fitContent();
    chart.addDrawing(TrendLine, {
      anchors: [
        { time: 20 * MINUTE, price: 120 },
        { time: 60 * MINUTE, price: 140 },
      ],
      options: { stats: "always", statsPosition: "center" },
    });

    await settle();
    expect(fillRects.some((rect) => rect.fillStyle === "rgba(248,250,252,0.94)")).toBe(true);
  });
});
