import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { CandlestickSeries, createChart, type ChartApi, type OhlcData } from "../src/index";

const charts: ChartApi[] = [];
let fillText: ReturnType<typeof vi.fn>;

function mount(): HTMLElement {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientWidth", { value: 800, configurable: true });
  Object.defineProperty(element, "clientHeight", { value: 400, configurable: true });
  document.body.appendChild(element);
  return element;
}

function bars(): OhlcData[] {
  return Array.from({ length: 12 }, (_, index) => ({
    time: index * 60_000,
    open: 100,
    high: 106,
    low: 94,
    close: 100,
  }));
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 25));
}

beforeAll(() => {
  fillText = vi.fn();
  const context = new Proxy(
    {
      fillText,
      measureText: (text: string) => ({ width: text.length * 7 }),
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
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    return setTimeout(() => callback(performance.now()), 0) as unknown as number;
  });
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => clearTimeout(handle));
});

afterEach(() => {
  while (charts.length > 0) {
    try {
      charts.pop()?.destroy();
    } catch {
      // Already destroyed.
    }
  }
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("price-line titles", () => {
  it("draws a plot title inside the plot and leaves the axis label to the price", async () => {
    const chart = createChart(mount());
    charts.push(chart);
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars());
    chart.timeScale().fitContent();
    series.createPriceLine({
      price: 105,
      title: "Entry",
      titlePosition: "plot",
      color: "#10b981",
    });
    await settle();

    const entry = fillText.mock.calls.find(([text]) => text === "Entry");
    expect(entry).toBeDefined();
    expect(entry?.[1]).toBeGreaterThan(0);
    expect(entry?.[1]).toBeLessThan(736);
  });

  it("keeps the default title in the axis label", async () => {
    fillText.mockClear();
    const chart = createChart(mount());
    charts.push(chart);
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars());
    chart.timeScale().fitContent();
    series.createPriceLine({ price: 105, title: "Exit" });
    await settle();

    const title = fillText.mock.calls.find(
      ([text]) => typeof text === "string" && text.startsWith("Exit "),
    );
    expect(title?.[1]).toBeGreaterThanOrEqual(736);
  });

  it("rejects unknown title positions", () => {
    const chart = createChart(mount());
    charts.push(chart);
    const series = chart.addSeries(CandlestickSeries);
    expect(() =>
      series.createPriceLine({
        price: 100,
        title: "Entry",
        titlePosition: "outside" as never,
      }),
    ).toThrow(/price line/);
  });
});
