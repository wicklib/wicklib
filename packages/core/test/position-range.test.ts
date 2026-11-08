import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  CandlestickSeries,
  LongPosition,
  PriceDateRange,
  PriceRangeDrawing,
  ShortPosition,
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
    expect(long.getOptions().statsFields).toEqual(["riskReward"]);
    expect(short.getOptions().statsFields).toEqual(["riskReward"]);
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
        stats: "always",
        statsFields: ["riskReward"],
      },
    });
    await settle();

    expect(textCalls.some((call) => call.text === "Stop")).toBe(true);
    expect(textCalls.some((call) => call.text === "Entry")).toBe(true);
    expect(textCalls.some((call) => call.text === "Profit")).toBe(true);
    expect(textCalls.some((call) => call.text === "R/R  2.00")).toBe(true);
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
});
