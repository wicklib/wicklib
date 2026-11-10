import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { CandlestickSeries, createChart, type ChartApi } from "../src/index";

const charts: ChartApi[] = [];
const fillRects: Array<{ fillStyle: string; width: number; height: number }> = [];

function mount(width: number): HTMLElement {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(element, "clientHeight", { value: 400, configurable: true });
  document.body.appendChild(element);
  return element;
}

function bars(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const open = 100 + Math.sin(index / 8) * 4;
    const close = 100 + Math.sin(index / 6) * 4;
    return {
      time: index * 60_000,
      open,
      high: Math.max(open, close) + 2 + Math.sin(index / 7),
      low: Math.min(open, close) - 2 + Math.sin(index / 9),
      close,
    };
  });
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 35));
}

beforeAll(() => {
  const target = {
    font: "12px sans-serif",
    fillStyle: "#000000",
    strokeStyle: "#000000",
    measureText: (text: string) => ({ width: String(text).length * 7 }),
    fillText: () => undefined,
    fillRect(this: { fillStyle: string }, _x: number, _y: number, width: number, height: number) {
      fillRects.push({ fillStyle: this.fillStyle, width, height });
    },
    createLinearGradient: () => ({ addColorStop: () => undefined }),
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
    charts.pop()?.destroy();
  }
  document.body.innerHTML = "";
  fillRects.length = 0;
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderAtWidth(width: number): Promise<ChartApi> {
  const chart = createChart(mount(width), {
    timeScale: { maxVisibleBars: 720, minBarSpacing: 0.001 },
  });
  charts.push(chart);
  const series = chart.addSeries(CandlestickSeries, {
    upColor: "#00ff00",
    downColor: "#ff0000",
    wickUpColor: "#00ff00",
    wickDownColor: "#ff0000",
  });
  series.setData(bars(720));
  chart.timeScale().fitContent();
  await settle();
  return chart;
}

describe("dense candle rendering", () => {
  it("uses sub-pixel candle bodies in narrow panes", async () => {
    await renderAtWidth(300);
    const candleFills = fillRects.filter(
      (rect) => (rect.fillStyle === "#00ff00" || rect.fillStyle === "#ff0000") && rect.width < 5,
    );
    expect(candleFills.length).toBeGreaterThan(0);
    expect(candleFills.every((rect) => rect.width < 1.5)).toBe(true);
  });

  it("keeps normal candle bodies in wide panes", async () => {
    await renderAtWidth(1200);
    const candleFills = fillRects.filter(
      (rect) => (rect.fillStyle === "#00ff00" || rect.fillStyle === "#ff0000") && rect.width < 30,
    );
    expect(candleFills.length).toBeGreaterThan(0);
    expect(candleFills.some((rect) => rect.width > 1)).toBe(true);
  });
});
