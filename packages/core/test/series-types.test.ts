import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  AreaSeries,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
  type ChartApi,
  type Datafeed,
  type IndicatorDefinition,
  type LineData,
  type OhlcData,
} from "../src/index";

const charts: ChartApi[] = [];
const MINUTE = 60_000;

function mount(): HTMLElement {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientWidth", { value: 800, configurable: true });
  Object.defineProperty(element, "clientHeight", { value: 400, configurable: true });
  document.body.appendChild(element);
  return element;
}

function track(chart: ChartApi): ChartApi {
  charts.push(chart);
  return chart;
}

function lineData(start = 100, count = 40): LineData[] {
  return Array.from({ length: count }, (_, index) => ({
    time: index * MINUTE,
    value: start + index,
  }));
}

function candleData(count = 40): OhlcData[] {
  return Array.from({ length: count }, (_, index) => ({
    time: index * MINUTE,
    open: 100 + index,
    high: 102 + index,
    low: 98 + index,
    close: 101 + index,
  }));
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 25));
}

const SimpleIndicator: IndicatorDefinition = {
  meta: { id: "com.test.simple", name: "Simple", version: "1.0.0", license: "free" },
  inputs: [],
  plots: [{ id: "line", title: "Line", type: "line" }],
  compute({ bars }) {
    return { line: Array.from({ length: bars.length }, (_, index) => bars.closeAt(index)) };
  },
};

beforeAll(() => {
  const context = new Proxy(
    {
      measureText: (text: string) => ({ width: text.length * 7 }),
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

describe("built-in series types", () => {
  it("renders line, area, and histogram series", async () => {
    const chart = track(createChart(mount()));
    const line = chart.addSeries(LineSeries, { title: "Line", color: "#ff0000" });
    const area = chart.addSeries(AreaSeries, { title: "Area" });
    const histogram = chart.addSeries(HistogramSeries, { title: "Histogram", base: 100 });
    line.setData(lineData());
    area.setData(lineData(120));
    histogram.setData(lineData(80));
    chart.timeScale().fitContent();
    await settle();

    const screenshot = chart.takeScreenshot();
    expect(screenshot.width).toBeGreaterThan(0);
    expect(line.priceScale().getVisibleRange().max).toBeGreaterThanOrEqual(159);
    expect(() =>
      line.setMarkers([{ time: 3 * MINUTE, position: "aboveBar", text: "x" }]),
    ).not.toThrow();
  });

  it("supports line-series datafeeds", async () => {
    const chart = track(createChart(mount()));
    const series = chart.addSeries(LineSeries);
    const feed: Datafeed<LineData> = {
      async getData() {
        return { data: lineData() };
      },
    };

    series.setDatafeed(feed, { symbol: "TEST", interval: "1m", initialBars: 10 });
    await settle();

    expect(series.isLoading()).toBe(false);
    expect(chart.timeScale().getVisibleRange().to).toBeGreaterThan(0);
    series.clearDatafeed();
    expect(() => series.setData(lineData())).not.toThrow();
  });

  it("keeps mixed series in one price range", async () => {
    const chart = track(createChart(mount()));
    const candle = chart.addSeries(CandlestickSeries);
    const line = chart.addSeries(LineSeries);
    candle.setData(candleData());
    line.setData(lineData(300));
    chart.timeScale().fitContent();
    await settle();

    expect(candle.priceScale().getVisibleRange().max).toBeGreaterThanOrEqual(339);
  });

  it("requires a candlestick source for indicators", () => {
    const chart = track(createChart(mount()));
    const line = chart.addSeries(LineSeries);
    line.setData(lineData());
    expect(() => chart.addIndicator(SimpleIndicator)).toThrow(/candlestick/);
  });

  it("includes the histogram baseline in auto-scale", async () => {
    const chart = track(createChart(mount()));
    const histogram = chart.addSeries(HistogramSeries, { base: 0 });
    histogram.setData(lineData(80));
    chart.timeScale().fitContent();
    await settle();

    expect(histogram.priceScale().getVisibleRange().min).toBeLessThanOrEqual(0);
  });

  it("rejects unknown series types and invalid line widths", () => {
    const chart = track(createChart(mount()));
    expect(() => chart.addSeries({ id: "unknown" } as never)).toThrow(/Unsupported series/);
    expect(() => chart.addSeries(LineSeries, { lineWidth: 0 })).toThrow(/lineWidth/);
  });

  it("rejects invalid line values", () => {
    const chart = track(createChart(mount()));
    const series = chart.addSeries(LineSeries);
    expect(() => series.setData([{ time: 0 }] as never)).toThrow(/value/);
  });
});
