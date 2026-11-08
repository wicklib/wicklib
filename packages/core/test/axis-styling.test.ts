import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { LineSeries, Text, createChart, type ChartApi, type LineData } from "../src/index";

const charts: ChartApi[] = [];
const containers: HTMLElement[] = [];
const textCalls: Array<{
  text: string;
  x: number;
  y: number;
  fillStyle: string;
  font: string;
  textAlign: string;
  textBaseline: string;
}> = [];
const fillRects: Array<{ x: number; y: number; width: number; height: number; fillStyle: string }> =
  [];
const strokes: Array<{ strokeStyle: string; path: Array<{ x: number; y: number }> }> = [];

function mount(): HTMLElement {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientWidth", { value: 800, configurable: true });
  Object.defineProperty(element, "clientHeight", { value: 400, configurable: true });
  document.body.appendChild(element);
  containers.push(element);
  return element;
}

function data(count = 50): LineData[] {
  return Array.from({ length: count }, (_, index) => ({
    time: index * 60_000,
    value: 100 + index,
  }));
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

beforeAll(() => {
  let path: Array<{ x: number; y: number }> = [];
  const target = {
    font: "12px sans-serif",
    fillStyle: "#000000",
    strokeStyle: "#000000",
    textAlign: "left",
    textBaseline: "alphabetic",
    measureText(this: { font: string }, text: string) {
      const size = Number.parseFloat(this.font) || 12;
      return { width: String(text).length * size * 0.6 };
    },
    fillText(
      this: {
        fillStyle: string;
        font: string;
        textAlign: string;
        textBaseline: string;
      },
      text: string,
      x: number,
      y: number,
    ) {
      textCalls.push({
        text: String(text),
        x,
        y,
        fillStyle: this.fillStyle,
        font: this.font,
        textAlign: this.textAlign,
        textBaseline: this.textBaseline,
      });
    },
    fillRect(this: { fillStyle: string }, x: number, y: number, width: number, height: number) {
      fillRects.push({ x, y, width, height, fillStyle: this.fillStyle });
    },
    beginPath() {
      path = [];
    },
    moveTo(x: number, y: number) {
      path.push({ x, y });
    },
    lineTo(x: number, y: number) {
      path.push({ x, y });
    },
    stroke(this: { strokeStyle: string }) {
      strokes.push({ strokeStyle: this.strokeStyle, path: [...path] });
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

function addLineChart(
  options: Parameters<typeof createChart>[1] = {},
  seriesColor = "#123456",
): { chart: ChartApi; element: HTMLElement; title: string } {
  const element = mount();
  const chart = createChart(element, options);
  charts.push(chart);
  const series = chart.addSeries(LineSeries, {
    title: "Price",
    color: seriesColor,
    lastValueVisible: true,
  });
  series.setData(data());
  chart.timeScale().fitContent();
  return { chart, element, title: "Price" };
}

function priceTickTexts(): typeof textCalls {
  return textCalls.filter((call) => call.x > 700 && /^[0-9.,]+$/.test(call.text));
}

function timeLabelTexts(): typeof textCalls {
  return textCalls.filter((call) => call.y > 350 && call.textBaseline === "middle");
}

describe("axis styling", () => {
  it("uses layout fallbacks when axis options are omitted", async () => {
    addLineChart({
      layout: { textColor: "#314159" },
      grid: {
        horzLines: { color: "#111111" },
        vertLines: { color: "#222222" },
      },
    });
    await settle();

    expect(priceTickTexts().every((call) => call.fillStyle === "#314159")).toBe(true);
    expect(priceTickTexts().every((call) => call.font.startsWith("12px"))).toBe(true);
    expect(timeLabelTexts().some((call) => call.fillStyle === "#314159")).toBe(true);
    expect(timeLabelTexts().some((call) => Math.abs(call.y - 386) < 1)).toBe(true);

    const borderStrokes = strokes.filter(
      (stroke) => stroke.strokeStyle === "#111111" || stroke.strokeStyle === "#222222",
    );
    expect(
      borderStrokes.some(
        (stroke) =>
          stroke.strokeStyle === "#111111" &&
          stroke.path.length === 2 &&
          stroke.path[0]!.x === stroke.path[1]!.x,
      ),
    ).toBe(true);
    expect(
      borderStrokes.some(
        (stroke) =>
          stroke.strokeStyle === "#222222" &&
          stroke.path.length === 2 &&
          stroke.path[0]!.y === stroke.path[1]!.y,
      ),
    ).toBe(true);
  });

  it("falls back axisFontSize to layout.fontSize", async () => {
    addLineChart({ layout: { fontSize: 16 } });
    await settle();

    expect(priceTickTexts().every((call) => call.font.startsWith("16px"))).toBe(true);
    expect(timeLabelTexts().some((call) => Math.abs(call.y - 384) < 1)).toBe(true);
  });

  it("keeps axis text overrides away from the legend and drawings", async () => {
    const { chart } = addLineChart({
      layout: { textColor: "#111111", axisTextColor: "#abcdef", axisFontSize: 12 },
    });
    chart.addDrawing(Text, {
      anchors: [{ time: 0, price: 100 }],
      options: { text: "DrawText", color: "#223344" },
    });
    await settle();

    expect(priceTickTexts().every((call) => call.fillStyle === "#abcdef")).toBe(true);
    expect(timeLabelTexts().some((call) => call.fillStyle === "#abcdef")).toBe(true);
    expect(
      textCalls
        .filter((call) => call.text === "Price")
        .every((call) => call.fillStyle === "#111111"),
    ).toBe(true);
    expect(textCalls.find((call) => call.text === "DrawText")?.fillStyle).toBe("#223344");
  });

  it("resizes axis width, time-axis height, and label boxes live", async () => {
    const { chart, element } = addLineChart();
    await settle();
    const initialTicks = priceTickTexts();
    const initialTime = timeLabelTexts().find((call) => Math.abs(call.y - 386) < 1);
    expect(initialTicks.length).toBeGreaterThan(0);
    expect(initialTime).toBeDefined();
    const initialPriceX = Math.min(...initialTicks.map((call) => call.x));

    textCalls.length = 0;
    fillRects.length = 0;
    chart.setOptions({
      layout: { axisTextColor: "#abcdef", axisFontSize: 24, axisLineColor: "#ff00ff" },
    });
    await settle();

    const resizedTicks = priceTickTexts();
    expect(resizedTicks.every((call) => call.fillStyle === "#abcdef")).toBe(true);
    expect(resizedTicks.every((call) => call.font.startsWith("24px"))).toBe(true);
    expect(Math.min(...resizedTicks.map((call) => call.x))).toBeLessThan(initialPriceX);
    expect(timeLabelTexts().some((call) => Math.abs(call.y - 380) < 1)).toBe(true);

    const root = element.firstElementChild as HTMLElement;
    root.dispatchEvent(
      new MouseEvent("pointermove", { clientX: 100, clientY: 100, bubbles: true }),
    );
    await settle();

    const crosshairHeights = fillRects
      .filter((rect) => rect.fillStyle === "rgba(17,24,39,0.94)")
      .map((rect) => rect.height);
    expect(crosshairHeights).toContain(30);
    expect(crosshairHeights).toContain(40);
    expect(textCalls.filter((call) => call.fillStyle === "#f9fafb").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(textCalls.some((call) => call.fillStyle === "#abcdef" && call.y > 350)).toBe(true);

    const lastValueHeights = fillRects
      .filter((rect) => rect.fillStyle === "#123456")
      .map((rect) => rect.height);
    expect(lastValueHeights).toContain(30);
  });

  it("rejects crosshair label backgrounds that disappear into the canvas", async () => {
    const { element } = addLineChart({
      layout: { background: "#000000", textColor: "#ffffff" },
      crosshair: { labelBackground: "#000000" },
    });
    await settle();

    const root = element.firstElementChild as HTMLElement;
    root.dispatchEvent(
      new MouseEvent("pointermove", { clientX: 100, clientY: 100, bubbles: true }),
    );
    await settle();

    const crosshairHeights = fillRects
      .filter((rect) => rect.fillStyle === "rgba(248,250,252,0.94)")
      .map((rect) => rect.height);
    expect(crosshairHeights).toContain(18);
    expect(crosshairHeights).toContain(28);
    expect(textCalls.some((call) => call.fillStyle === "#111827")).toBe(true);
  });

  it("applies axisLineColor only to visible axis borders", async () => {
    const visibleElement = mount();
    const visible = createChart(visibleElement, {
      layout: { axisLineColor: "#ff00ff" },
      grid: { horzLines: { visible: false }, vertLines: { visible: false } },
    });
    charts.push(visible);
    await settle();
    const visibleStrokes = strokes.filter((stroke) => stroke.strokeStyle === "#ff00ff");
    expect(visibleStrokes.length).toBeGreaterThanOrEqual(2);
    expect(
      visibleStrokes.some(
        (stroke) => stroke.path.length === 2 && stroke.path[0]!.x === stroke.path[1]!.x,
      ),
    ).toBe(true);
    expect(
      visibleStrokes.some(
        (stroke) => stroke.path.length === 2 && stroke.path[0]!.y === stroke.path[1]!.y,
      ),
    ).toBe(true);

    strokes.length = 0;
    const hiddenElement = mount();
    const hidden = createChart(hiddenElement, {
      layout: { axisLineColor: "#ff00ff" },
      priceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      grid: { horzLines: { visible: false }, vertLines: { visible: false } },
    });
    charts.push(hidden);
    await settle();
    expect(strokes.some((stroke) => stroke.strokeStyle === "#ff00ff")).toBe(false);
  });

  it("validates axisFontSize", () => {
    expect(() => createChart(mount(), { layout: { axisFontSize: 0 } })).toThrow(
      /layout\.axisFontSize/,
    );
    expect(() => createChart(mount(), { layout: { axisFontSize: Number.NaN } })).toThrow(
      /layout\.axisFontSize/,
    );
  });
});
