import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  CandlestickSeries,
  ElliottCorrection,
  ElliottDoubleCombo,
  ElliottImpulse,
  ElliottTriangle,
  ElliottTripleCombo,
  createChart,
  type ChartApi,
  type OhlcData,
} from "../src/index";

const MINUTE = 60_000;
const charts: ChartApi[] = [];
const containers: HTMLElement[] = [];
const textCalls: Array<{ text: string; font: string; fillStyle: string }> = [];
const fillStyles: string[] = [];

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
    fillText(this: { font: string; fillStyle: string }, text: string) {
      textCalls.push({ text: String(text), font: this.font, fillStyle: this.fillStyle });
    },
    fillRect(this: { fillStyle: string }) {
      fillStyles.push(this.fillStyle);
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
});
