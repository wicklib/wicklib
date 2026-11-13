import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  Brush,
  CandlestickSeries,
  FibExtension,
  FibRetracement,
  LongPosition,
  ParallelChannel,
  PriceDateRange,
  PriceRangeDrawing,
  RegressionTrend,
  ShortPosition,
  Text,
  TimeRangeDrawing,
  createChart,
  type ChartApi,
  type OhlcData,
} from "../src/index";

const MINUTE = 60_000;
const charts: ChartApi[] = [];
const containers: HTMLElement[] = [];
const textCalls: Array<{ text: string; x: number; y: number; fillStyle: string; font: string }> =
  [];
const fillRects: Array<{ x: number; y: number; width: number; height: number; fillStyle: string }> =
  [];
const strokes: string[] = [];

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
    open: 100 + index * 0.1,
    high: 101 + index * 0.1,
    low: 99 + index * 0.1,
    close: 100 + index * 0.1,
    volume: 1_000 + index,
  }));
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

beforeAll(() => {
  const context = new Proxy(
    {
      font: "12px sans-serif",
      fillStyle: "#000000",
      strokeStyle: "#000000",
      textAlign: "left",
      textBaseline: "alphabetic",
      measureText(this: { font: string }, text: string) {
        const size = Number.parseFloat(this.font) || 12;
        return { width: String(text).length * size * 0.6 };
      },
      fillText(this: { fillStyle: string; font: string }, text: string, x: number, y: number) {
        textCalls.push({ text: String(text), x, y, fillStyle: this.fillStyle, font: this.font });
      },
      fillRect(this: { fillStyle: string }, x: number, y: number, width: number, height: number) {
        fillRects.push({ x, y, width, height, fillStyle: this.fillStyle });
      },
      stroke(this: { strokeStyle: string }) {
        strokes.push(this.strokeStyle);
      },
      createLinearGradient: () => ({ addColorStop: () => undefined }),
    } as Record<string, unknown>,
    {
      get(target, property) {
        return property in target ? target[property as string] : () => undefined;
      },
      set(target, property, value) {
        target[property as string] = value;
        return true;
      },
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => context as unknown as CanvasRenderingContext2D,
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => clearTimeout(handle));

  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
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
  fillRects.length = 0;
  strokes.length = 0;
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function addChart(): ChartApi {
  const chart = createChart(mount());
  charts.push(chart);
  const series = chart.addSeries(CandlestickSeries);
  series.setData(bars());
  chart.timeScale().fitContent();
  series.priceScale().setOptions({ priceFormat: { precision: 2 } });
  return chart;
}

describe("position drawings", () => {
  it("creates long and short positions from one anchor", () => {
    const chart = addChart();
    const long = chart.addDrawing(LongPosition, {
      anchors: [{ time: 20 * MINUTE, price: 100 }],
    });
    const short = chart.addDrawing(ShortPosition, {
      anchors: [{ time: 20 * MINUTE, price: 100 }],
    });

    const longAnchors = long.getAnchors();
    const shortAnchors = short.getAnchors();
    expect(longAnchors).toHaveLength(4);
    expect(shortAnchors).toHaveLength(4);
    expect(longAnchors[1]!.price).toBeLessThan(100);
    expect(longAnchors[2]!.price).toBeGreaterThan(100);
    expect(shortAnchors[1]!.price).toBeGreaterThan(100);
    expect(shortAnchors[2]!.price).toBeLessThan(100);
    expect(longAnchors[3]!.time).toBeGreaterThan(20 * MINUTE);
    expect(long.getOptions().priceLabels).toBe("always");
    expect(long.getOptions().positionStatsFields).toEqual([
      "loss",
      "lossPercent",
      "profitPercent",
      "riskAmount",
      "entry",
      "profit",
      "riskReward",
    ]);
    expect(short.getOptions().positionStatsFields).toEqual([
      "loss",
      "lossPercent",
      "profitPercent",
      "riskAmount",
      "entry",
      "profit",
      "riskReward",
    ]);
  });

  it("aligns position stats boxes left, center, and right", async () => {
    const chart = addChart();
    const drawing = chart.addDrawing(LongPosition, {
      anchors: [
        { time: 20 * MINUTE, price: 100 },
        { time: 20 * MINUTE, price: 98 },
        { time: 20 * MINUTE, price: 104 },
        { time: 60 * MINUTE, price: 100 },
      ],
      options: { positionStatsFields: ["entry"], statsPosition: "left" },
    });
    await settle();
    const left = textCalls.find((call) => call.text.startsWith("Entry  "))?.x;
    expect(left).toBeDefined();

    textCalls.length = 0;
    drawing.setOptions({ statsPosition: "center" });
    await settle();
    const center = textCalls.find((call) => call.text.startsWith("Entry  "))?.x;
    expect(center).toBeDefined();

    textCalls.length = 0;
    drawing.setOptions({ statsPosition: "right" });
    await settle();
    const right = textCalls.find((call) => call.text.startsWith("Entry  "))?.x;
    expect(right).toBeDefined();
    expect(left!).toBeLessThan(center!);
    expect(center!).toBeLessThan(right!);
  });

  it("hides position stats boxes with the price label setting", async () => {
    const chart = addChart();
    const drawing = chart.addDrawing(LongPosition, {
      anchors: [
        { time: 20 * MINUTE, price: 100 },
        { time: 20 * MINUTE, price: 98 },
        { time: 20 * MINUTE, price: 104 },
        { time: 60 * MINUTE, price: 100 },
      ],
      options: { positionStatsFields: ["loss", "entry", "profit"] },
    });
    await settle();
    expect(textCalls.some((call) => call.text.startsWith("Loss  "))).toBe(true);

    textCalls.length = 0;
    drawing.setOptions({ priceLabels: "never" });
    await settle();
    expect(textCalls.some((call) => call.text.startsWith("Loss  "))).toBe(false);
    expect(textCalls.some((call) => call.text.startsWith("Entry  "))).toBe(false);
    expect(textCalls.some((call) => call.text.startsWith("Profit  "))).toBe(false);
    expect(textCalls.some((call) => call.text === "200")).toBe(false);
  });

  it("renders position labels, fills, stats, and axis labels", async () => {
    const chart = addChart();
    chart.addDrawing(LongPosition, {
      anchors: [
        { time: 20 * MINUTE, price: 100 },
        { time: 20 * MINUTE, price: 98 },
        { time: 20 * MINUTE, price: 104 },
        { time: 60 * MINUTE, price: 100 },
      ],
      options: {
        stopColor: "#ff0000",
        targetColor: "#00ff00",
        labelTextColor: "#abcdef",
        positionStatsFields: [
          "loss",
          "lossPercent",
          "profitPercent",
          "riskAmount",
          "entry",
          "profit",
          "riskReward",
          "lotSize",
        ],
      },
    });
    await settle();

    expect(
      textCalls.some(
        (call) => call.text.includes("Loss  100") && call.text.includes("Risk amount  100"),
      ),
    ).toBe(true);
    expect(
      textCalls.some(
        (call) => call.text.includes("Entry  100.00") && call.text.includes("Lot size  50"),
      ),
    ).toBe(true);
    expect(
      textCalls.some(
        (call) =>
          call.text.includes("200") &&
          call.text.includes("Profit %  4.00%") &&
          call.text.includes("R/R  2.00"),
      ),
    ).toBe(true);
    expect(textCalls.filter((call) => call.fillStyle === "#abcdef").length).toBeGreaterThanOrEqual(
      6,
    );
    expect(fillRects.some((rect) => rect.fillStyle === "#ff0000")).toBe(true);
    expect(fillRects.some((rect) => rect.fillStyle === "#00ff00")).toBe(true);
    expect(strokes).toContain("#00ff00");
    expect(strokes).not.toContain("#ff0000");
    expect(textCalls.some((call) => call.text === "98.00")).toBe(true);
    expect(textCalls.some((call) => call.text === "100.00")).toBe(true);
    expect(textCalls.some((call) => call.text === "104.00")).toBe(true);
  });
});

describe("range drawings", () => {
  it("uses range defaults and renders bars, time, and volume stats", async () => {
    const chart = addChart();
    const priceRange = chart.addDrawing(PriceRangeDrawing, {
      anchors: [
        { time: 20 * MINUTE, price: 101 },
        { time: 60 * MINUTE, price: 106 },
      ],
    });
    const timeRange = chart.addDrawing(TimeRangeDrawing, {
      anchors: [
        { time: 20 * MINUTE, price: 101 },
        { time: 60 * MINUTE, price: 106 },
      ],
    });
    const datePriceRange = chart.addDrawing(PriceDateRange, {
      anchors: [
        { time: 20 * MINUTE, price: 101 },
        { time: 60 * MINUTE, price: 106 },
      ],
    });
    await settle();

    expect(priceRange.getOptions().extendLeft).toBe(true);
    expect(priceRange.getOptions().extendRight).toBe(true);
    expect(timeRange.getOptions().extendTop).toBe(true);
    expect(timeRange.getOptions().extendBottom).toBe(true);
    expect(datePriceRange.getOptions().extendLeft).toBe(false);
    expect(textCalls.some((call) => call.text.startsWith("Bars  "))).toBe(true);
    expect(textCalls.some((call) => call.text.startsWith("Time  "))).toBe(true);
    expect(textCalls.some((call) => call.text.startsWith("Volume  "))).toBe(true);
  });
  it("renders modern channel, regression, Fibonacci, text, and freehand styles", async () => {
    const chart = addChart();
    chart.addDrawing(ParallelChannel, {
      anchors: [
        { time: 20 * MINUTE, price: 101 },
        { time: 60 * MINUTE, price: 106 },
        { time: 20 * MINUTE, price: 99 },
      ],
      options: {
        channelBackgroundVisible: true,
        topLineStyle: "dashed",
        bottomLineStyle: "dotted",
        middleLineVisible: true,
      },
    });
    chart.addDrawing(RegressionTrend, {
      anchors: [
        { time: 20 * MINUTE, price: 101 },
        { time: 60 * MINUTE, price: 106 },
      ],
      options: { channelBackgroundVisible: true },
    });
    chart.addDrawing(FibRetracement, {
      anchors: [
        { time: 20 * MINUTE, price: 101 },
        { time: 60 * MINUTE, price: 106 },
      ],
      options: {
        fibBackgroundVisible: true,
        fibLevels: [
          { ratio: 0, color: "#ff0000" },
          { ratio: 0.5, color: "#00ff00", lineStyle: "dashed" },
          { ratio: 1, color: "#0000ff", visible: false },
        ],
      },
    });
    chart.addDrawing(FibExtension, {
      anchors: [
        { time: 20 * MINUTE, price: 101 },
        { time: 30 * MINUTE, price: 103 },
        { time: 40 * MINUTE, price: 102 },
      ],
      options: { fibLevels: [{ ratio: 1.618, labelVisible: true }] },
    });
    chart.addDrawing(Text, {
      anchors: [{ time: 20 * MINUTE, price: 104 }],
      options: {
        text: "Styled",
        fontFamily: "serif",
        backgroundColor: "#ffffff",
        borderColor: "#000000",
        borderWidth: 1,
        borderRadius: 4,
        padding: 6,
      },
    });
    chart.addDrawing(Brush, {
      anchors: [
        { time: 20 * MINUTE, price: 102 },
        { time: 25 * MINUTE, price: 103 },
        { time: 30 * MINUTE, price: 102.5 },
      ],
      options: { lineOpacity: 0.5 },
    });
    await settle();

    expect(textCalls.some((call) => call.text.startsWith("0.500  "))).toBe(true);
    expect(textCalls.some((call) => call.text.startsWith("1.618  "))).toBe(true);
    expect(textCalls.some((call) => call.text === "Styled")).toBe(true);
  });
});
