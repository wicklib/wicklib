import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createChart, mapLightweightChartOptions, type ChartApi } from "../src/index";

beforeAll(() => {
  const context = new Proxy(
    { measureText: (text: string) => ({ width: text.length * 7 }) } as Record<string, unknown>,
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
});

afterAll(() => {
  vi.restoreAllMocks();
});

function mount(): HTMLElement {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientWidth", { value: 800, configurable: true });
  Object.defineProperty(element, "clientHeight", { value: 400, configurable: true });
  document.body.appendChild(element);
  return element;
}

describe("mapLightweightChartOptions", () => {
  it("maps the chart options used by notebook embeds", () => {
    const mapped = mapLightweightChartOptions({
      autoSize: true,
      layout: {
        background: { type: 0, color: "transparent" },
        textColor: "rgba(148,163,184,1)",
      },
      grid: {
        vertLines: { color: "rgba(128,128,128,0.08)" },
        horzLines: { color: "rgba(128,128,128,0.08)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: false,
        pinch: true,
        axisPressedMouseMove: true,
        axisDoubleClickReset: true,
      },
    });

    expect(mapped).toMatchObject({
      autoSize: true,
      layout: { background: "transparent", textColor: "rgba(148,163,184,1)" },
      grid: {
        vertLines: { color: "rgba(128,128,128,0.08)" },
        horzLines: { color: "rgba(128,128,128,0.08)" },
      },
      interaction: {
        wheel: false,
        drag: true,
        pinch: true,
        axisDrag: true,
        axisDoubleClickReset: true,
      },
      priceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
    });
  });

  it("does not inject defaults for sparse options", () => {
    expect(mapLightweightChartOptions({})).toEqual({});
    expect(mapLightweightChartOptions({ handleScroll: { mouseWheel: false } })).toEqual({
      interaction: { wheel: false },
    });
  });

  it("maps crosshair, locale, and line styles", () => {
    const mapped = mapLightweightChartOptions({
      localization: { locale: "en-GB" },
      crosshair: {
        mode: 1,
        vertLine: { style: 2, color: "#999", labelBackgroundColor: "#111" },
      },
      timeScale: { rightOffset: 5, barSpacing: 10 },
    });

    expect(mapped.locale).toBe("en-GB");
    expect(mapped.crosshair).toMatchObject({
      mode: "magnet",
      vertLine: { style: "dashed", color: "#999" },
      labelBackground: "#111",
    });
    expect(mapped.timeScale).toMatchObject({ rightOffset: 5, barSpacing: 10 });
  });

  it("maps supported price modes and rejects unsupported ones", () => {
    expect(mapLightweightChartOptions({ rightPriceScale: { mode: 1 } }).priceScale).toEqual({
      mode: "logarithmic",
    });
    expect(() => mapLightweightChartOptions({ rightPriceScale: { mode: 2 } })).toThrow(
      /normal and logarithmic/,
    );
  });
});

describe("interaction options", () => {
  it("accepts interaction and time-axis border options", () => {
    const charts: ChartApi[] = [];
    const chart = createChart(mount(), {
      interaction: { wheel: false },
      timeScale: { borderVisible: false },
    });
    charts.push(chart);
    chart.setOptions({ interaction: { axisDrag: false, axisDoubleClickReset: false } });
    expect(() => chart.destroy()).not.toThrow();
    charts.length = 0;
  });
});
