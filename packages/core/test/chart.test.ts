import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  CandlestickSeries,
  createChart,
  HorizontalLine,
  Measure,
  Rectangle,
  TrendLine,
  type ChartApi,
  type ChartErrorEvent,
  type CrosshairEvent,
  type Datafeed,
  type IndicatorDefinition,
  type OhlcData,
} from "../src/index";

const charts: ChartApi[] = [];
const containers: HTMLElement[] = [];
const MINUTE = 60_000;

function mount(): HTMLElement {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientWidth", { value: 800, configurable: true });
  Object.defineProperty(element, "clientHeight", { value: 400, configurable: true });
  document.body.appendChild(element);
  containers.push(element);
  return element;
}

function track(chart: ChartApi): ChartApi {
  charts.push(chart);
  return chart;
}

function bars(count: number): OhlcData[] {
  let price = 100;
  const result: OhlcData[] = [];

  for (let index = 0; index < count; index += 1) {
    const open = price;
    const close = open + Math.sin(index / 5) * 2;
    const high = Math.max(open, close) + 1;
    const low = Math.min(open, close) - 1;
    result.push({ time: index * MINUTE, open, high, low, close });
    price = close;
  }

  return result;
}

function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 25);
  });
}

function pointerEvent(type: string, pointerId: number, x: number, y: number): MouseEvent {
  const event = new MouseEvent(type, {
    clientX: x,
    clientY: y,
    bubbles: true,
    button: 0,
  });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  return event;
}

const MultiplierIndicator: IndicatorDefinition<{ multiplier: number }> = {
  meta: {
    id: "com.test.multiplier",
    name: "Multiplier",
    version: "1.0.0",
    license: "free",
  },
  inputs: [
    {
      id: "multiplier",
      name: "Multiplier",
      type: "number",
      defaultValue: 2,
      min: 0,
    },
  ],
  plots: [{ id: "line", title: "Line", type: "line" }],
  compute({ bars, inputs }) {
    const values: number[] = [];
    for (let index = 0; index < bars.length; index += 1) {
      values.push(bars.closeAt(index) * inputs.multiplier);
    }
    return { line: values };
  },
};

const BrokenIndicator: IndicatorDefinition = {
  meta: {
    id: "com.test.broken",
    name: "Broken",
    version: "1.0.0",
    license: "free",
  },
  inputs: [],
  plots: [{ id: "line", title: "Line", type: "line" }],
  compute() {
    return { line: [1] };
  },
};

beforeAll(() => {
  const context = new Proxy(
    { measureText: (text: string) => ({ width: text.length * 7 }) } as Record<string, unknown>,
    {
      get(target, property) {
        if (property in target) {
          return target[property as string];
        }
        return () => undefined;
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
    return setTimeout(() => {
      callback(performance.now());
    }, 0) as unknown as number;
  });

  vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
    clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
  });

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
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("createChart", () => {
  it("emits ready and reports a visible range", async () => {
    const chart = track(createChart(mount()));
    const ready = new Promise<void>((resolve) => {
      chart.on("ready", () => resolve());
    });

    const series = chart.addSeries(CandlestickSeries, { title: "TEST" });
    series.setData(bars(50));
    chart.timeScale().fitContent();

    await ready;

    const range = chart.timeScale().getVisibleRange();
    expect(range.to).toBeGreaterThan(range.from);
    expect(series.paneId).toBe("main");
  });

  it("emits crosshair events on pointer move", () => {
    const element = mount();
    const chart = track(createChart(element));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(50));
    chart.timeScale().fitContent();

    const events: CrosshairEvent[] = [];
    chart.on("crosshair", (event) => events.push(event));

    const root = element.firstElementChild as HTMLElement;
    root.dispatchEvent(
      new MouseEvent("pointermove", { clientX: 100, clientY: 100, bubbles: true }),
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.point).toEqual({ x: 100, y: 100 });
    expect(events[0]?.time).toBeTypeOf("number");
    expect(events[0]?.price).toBeTypeOf("number");
  });

  it("supports keyboard pan, zoom, and fit", () => {
    const element = mount();
    const chart = track(createChart(element));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(200));
    chart.timeScale().fitContent();

    const root = element.firstElementChild as HTMLElement;
    expect(root.tabIndex).toBe(0);

    const initial = chart.timeScale().getVisibleRange();
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    const panned = chart.timeScale().getVisibleRange();
    expect(panned.to).toBeLessThan(initial.to);

    const beforeZoom = panned.to - panned.from;
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "+", bubbles: true }));
    const zoomed = chart.timeScale().getVisibleRange();
    expect(zoomed.to - zoomed.from).toBeLessThan(beforeZoom);

    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    const fitted = chart.timeScale().getVisibleRange();
    expect(fitted.to - fitted.from).toBeGreaterThan(zoomed.to - zoomed.from);
  });

  it("pans the timeline with horizontal trackpad wheel movement", () => {
    const element = mount();
    const chart = track(createChart(element));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(1_000));
    chart.timeScale().fitContent();

    const root = element.firstElementChild as HTMLElement;
    const before = chart.timeScale().getVisibleRange();

    root.dispatchEvent(
      new WheelEvent("wheel", {
        deltaX: 200,
        deltaY: 0,
        clientX: 400,
        clientY: 200,
        bubbles: true,
        cancelable: true,
      }),
    );
    const forward = chart.timeScale().getVisibleRange();
    expect(forward.from).toBeGreaterThan(before.from);

    root.dispatchEvent(
      new WheelEvent("wheel", {
        deltaX: -200,
        deltaY: 0,
        clientX: 400,
        clientY: 200,
        bubbles: true,
        cancelable: true,
      }),
    );
    const backward = chart.timeScale().getVisibleRange();
    expect(backward.from).toBeLessThan(forward.from);
  });

  it("zooms the timeline by dragging the time axis", () => {
    const element = mount();
    const chart = track(createChart(element));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(1_000));
    chart.timeScale().fitContent();

    const before = chart.timeScale().getVisibleRange();
    const root = element.firstElementChild as HTMLElement;

    root.dispatchEvent(pointerEvent("pointerdown", 1, 400, 390));
    root.dispatchEvent(pointerEvent("pointermove", 1, 600, 390));
    root.dispatchEvent(pointerEvent("pointerup", 1, 600, 390));

    const after = chart.timeScale().getVisibleRange();
    expect(after.to - after.from).toBeLessThan(before.to - before.from);
  });

  it("disables both axis drags through the interaction option", () => {
    const element = mount();
    const chart = track(createChart(element));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(1_000));
    chart.timeScale().fitContent();
    chart.setOptions({ interaction: { axisDrag: false } });

    const before = chart.timeScale().getVisibleRange();
    const root = element.firstElementChild as HTMLElement;

    root.dispatchEvent(pointerEvent("pointerdown", 1, 400, 390));
    root.dispatchEvent(pointerEvent("pointermove", 1, 600, 390));
    root.dispatchEvent(pointerEvent("pointerup", 1, 600, 390));

    const after = chart.timeScale().getVisibleRange();
    expect(after).toEqual(before);
  });

  it("drags the price axis into manual mode and resets auto-scale on double click", () => {
    const element = mount();
    const chart = track(createChart(element));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(200));
    chart.timeScale().fitContent();

    const scale = series.priceScale();
    expect(scale.isAutoScale()).toBe(true);
    const before = scale.getVisibleRange();

    const root = element.firstElementChild as HTMLElement;
    root.dispatchEvent(pointerEvent("pointerdown", 1, 760, 200));
    root.dispatchEvent(pointerEvent("pointerup", 1, 760, 200));
    expect(scale.isAutoScale()).toBe(true);

    root.dispatchEvent(pointerEvent("pointerdown", 1, 760, 200));
    root.dispatchEvent(pointerEvent("pointermove", 1, 760, 240));
    root.dispatchEvent(pointerEvent("pointerup", 1, 760, 240));

    expect(scale.isAutoScale()).toBe(false);
    const after = scale.getVisibleRange();
    expect(after.max - after.min).not.toBeCloseTo(before.max - before.min);
    expect((after.min + after.max) / 2).toBeCloseTo((before.min + before.max) / 2);

    root.dispatchEvent(
      new MouseEvent("dblclick", { clientX: 760, clientY: 200, bubbles: true, cancelable: true }),
    );
    expect(scale.isAutoScale()).toBe(true);
  });

  it("resetView restores auto-scale and fits the timeline", () => {
    const element = mount();
    const chart = track(createChart(element));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(200));
    chart.timeScale().fitContent();

    const root = element.firstElementChild as HTMLElement;
    root.dispatchEvent(pointerEvent("pointerdown", 1, 760, 200));
    root.dispatchEvent(pointerEvent("pointermove", 1, 760, 240));
    root.dispatchEvent(pointerEvent("pointerup", 1, 760, 240));
    expect(series.priceScale().isAutoScale()).toBe(false);

    chart.timeScale().setVisibleRange({ from: 50 * MINUTE, to: 60 * MINUTE });
    chart.resetView();

    expect(series.priceScale().isAutoScale()).toBe(true);
    const range = chart.timeScale().getVisibleRange();
    expect(range.from).toBe(0);
    expect(range.to).toBe(199 * MINUTE);
  });

  it("pans price vertically only after the price scale leaves auto mode", () => {
    const element = mount();
    const chart = track(createChart(element));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(200));
    chart.timeScale().fitContent();

    const root = element.firstElementChild as HTMLElement;
    const scale = series.priceScale();

    root.dispatchEvent(pointerEvent("pointerdown", 1, 400, 200));
    root.dispatchEvent(pointerEvent("pointermove", 1, 440, 240));
    root.dispatchEvent(pointerEvent("pointerup", 1, 440, 240));
    expect(scale.isAutoScale()).toBe(true);

    root.dispatchEvent(pointerEvent("pointerdown", 1, 760, 200));
    root.dispatchEvent(pointerEvent("pointermove", 1, 760, 240));
    root.dispatchEvent(pointerEvent("pointerup", 1, 760, 240));
    const manual = scale.getVisibleRange();
    expect(scale.isAutoScale()).toBe(false);

    root.dispatchEvent(pointerEvent("pointerdown", 1, 400, 200));
    root.dispatchEvent(pointerEvent("pointermove", 1, 440, 240));
    root.dispatchEvent(pointerEvent("pointerup", 1, 440, 240));

    expect(scale.getVisibleRange()).not.toEqual(manual);
  });

  it("supports two-pointer pinch zoom", () => {
    const element = mount();
    const chart = track(createChart(element));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(200));
    chart.timeScale().fitContent();

    const root = element.firstElementChild as HTMLElement;
    const before = chart.timeScale().getVisibleRange();
    const beforeSpan = before.to - before.from;

    root.dispatchEvent(pointerEvent("pointerdown", 1, 200, 200));
    root.dispatchEvent(pointerEvent("pointerdown", 2, 400, 200));
    root.dispatchEvent(pointerEvent("pointermove", 2, 500, 200));

    const after = chart.timeScale().getVisibleRange();
    expect(after.to - after.from).toBeLessThan(beforeSpan);

    root.dispatchEvent(pointerEvent("pointerup", 2, 500, 200));
    root.dispatchEvent(pointerEvent("pointerup", 1, 200, 200));
  });

  it("rejects invalid data", () => {
    const chart = track(createChart(mount()));
    const series = chart.addSeries(CandlestickSeries);
    const data = bars(2);

    expect(() => series.setData([data[1]!, data[0]!])).toThrow(/strictly ascending/);
  });

  it("disposes cleanly and is idempotent", () => {
    const chart = createChart(mount());
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(5));

    chart.destroy();

    expect(() => chart.timeScale()).toThrow(/disposed/i);
    expect(() => series.setData([])).toThrow(/disposed/i);
    expect(() => chart.destroy()).not.toThrow();
  });

  it("keeps multiple charts independent", () => {
    const first = track(createChart(mount()));
    const second = track(createChart(mount()));

    first.addSeries(CandlestickSeries).setData(bars(10));
    second.addSeries(CandlestickSeries).setData(bars(20));

    first.destroy();

    expect(() => second.timeScale().getVisibleRange()).not.toThrow();
  });

  it("isolates throwing listeners and reports them", async () => {
    const chart = track(createChart(mount()));
    const errors: ChartErrorEvent[] = [];
    let secondRan = false;

    chart.on("error", (event) => errors.push(event));
    chart.on("ready", () => {
      throw new Error("boom");
    });
    chart.on("ready", () => {
      secondRan = true;
    });

    await settle();

    expect(secondRan).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("creates, resizes, and removes panes", () => {
    const chart = track(createChart(mount()));
    const pane = chart.addPane({ height: 120 });

    expect(pane.id).toBe("pane-1");
    expect(() => pane.setHeight(160)).not.toThrow();

    pane.remove();
    expect(() => chart.addPane()).not.toThrow();
  });

  it("applies chart options and locks extensions", () => {
    const chart = track(createChart(mount()));

    expect(() =>
      chart.setOptions({
        layout: { background: "#000000" },
        crosshair: { mode: "magnet" },
      }),
    ).not.toThrow();

    expect(() => chart.setOptions({ extensions: [] })).toThrow(/cannot be changed/);
  });

  it("rejects duplicate extension ids", () => {
    const extension = {
      kind: "feature" as const,
      meta: {
        id: "com.example.feature",
        name: "Example",
        version: "1.0.0",
        license: "free" as const,
      },
    };

    expect(() => createChart(mount(), { extensions: [extension, extension] })).toThrow(
      /Duplicate extension/,
    );
  });

  it("loads a series from a datafeed", async () => {
    const element = mount();
    const chart = track(createChart(element));
    const series = chart.addSeries(CandlestickSeries);
    const loading: boolean[] = [];
    let subscribed = false;
    let unsubscribed = false;

    chart.on("data-loading", (event) => loading.push(event.loading));

    const feed: Datafeed<OhlcData> = {
      async getData() {
        return { data: bars(30) };
      },
      subscribe() {
        subscribed = true;
        return () => {
          unsubscribed = true;
        };
      },
    };

    series.setDatafeed(feed, { symbol: "BTC", interval: "1m", initialBars: 10 });
    await settle();

    expect(series.isLoading()).toBe(false);
    expect(loading).toEqual([true, false]);
    expect(subscribed).toBe(true);
    expect(() => series.setData(bars(1))).toThrow(/datafeed/i);

    const range = chart.timeScale().getVisibleRange();
    expect(range.to).toBeGreaterThan(range.from);

    series.clearDatafeed();
    expect(unsubscribed).toBe(true);
    expect(() => series.setData(bars(2))).not.toThrow();
  });

  it("adds an indicator overlay and updates inputs", () => {
    const chart = track(createChart(mount()));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(50));

    const indicator = chart.addIndicator(MultiplierIndicator);
    expect(indicator.paneId).toBe("main");
    expect(indicator.sourceSeriesId).toBe(series.id);

    expect(() => indicator.setInputs({ multiplier: 3 })).not.toThrow();
    expect(() => indicator.setPlotOptions("line", { color: "#ffffff" })).not.toThrow();

    indicator.remove();
    expect(() => indicator.setInputs({ multiplier: 2 })).toThrow(/disposed/i);
  });

  it("creates a separate pane for a separate indicator", () => {
    const chart = track(createChart(mount()));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(50));

    const indicator = chart.addIndicator(MultiplierIndicator, { pane: "separate" });
    expect(indicator.paneId).not.toBe("main");
    indicator.remove();
  });

  it("rejects invalid indicator inputs and outputs", async () => {
    const chart = track(createChart(mount()));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(20));

    expect(() =>
      chart.addIndicator(MultiplierIndicator, {
        inputs: { multiplier: Number.NaN },
      }),
    ).toThrow(/finite/);

    const errors: ChartErrorEvent[] = [];
    chart.on("error", (event) => errors.push(event));
    chart.addIndicator(BrokenIndicator);
    await settle();

    expect(errors.some((event) => event.source === "indicator")).toBe(true);
  });

  it("removes dependent indicators when the source series is removed", () => {
    const chart = track(createChart(mount()));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(20));
    const indicator = chart.addIndicator(MultiplierIndicator);

    series.remove();

    expect(() => indicator.setInputs({ multiplier: 3 })).toThrow(/disposed/i);
  });

  it("reports the hovered pane on crosshair", () => {
    const element = mount();
    const chart = track(createChart(element));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(50));
    chart.timeScale().fitContent();

    const pane = chart.addPane({ height: 100 });
    const events: CrosshairEvent[] = [];
    chart.on("crosshair", (event) => events.push(event));

    const root = element.firstElementChild as HTMLElement;
    root.dispatchEvent(
      new MouseEvent("pointermove", {
        clientX: 100,
        clientY: 300,
        bubbles: true,
      }),
    );

    expect(events.at(-1)?.paneId).toBe(pane.id);

    pane.remove();
  });

  it("creates, serializes, and restores drawings", () => {
    const chart = track(createChart(mount()));
    chart.addSeries(CandlestickSeries).setData(bars(50));

    const drawing = chart.addDrawing(TrendLine, {
      anchors: [
        { time: 0, price: 100 },
        { time: 10 * MINUTE, price: 110 },
      ],
    });
    expect(drawing.toolId).toBe("trend-line");
    expect(drawing.paneId).toBe("main");
    expect(chart.selectedDrawing()?.id).toBe(drawing.id);

    drawing.setOptions({ color: "#ffffff", locked: true });
    const document = chart.serializeDrawings();
    expect(document.version).toBe(1);
    expect(document.drawings).toHaveLength(1);
    expect(document.drawings[0]?.options.color).toBe("#ffffff");
    expect(document.drawings[0]?.options.locked).toBe(true);

    const restored = track(createChart(mount()));
    restored.addSeries(CandlestickSeries).setData(bars(50));
    restored.loadDrawings(document);

    expect(restored.serializeDrawings().drawings).toEqual(document.drawings);
    expect(restored.selectedDrawing()).toBeNull();
  });

  it("places drawing anchors at the pointer even with crosshair magnet enabled", () => {
    const element = mount();
    const chart = track(createChart(element, { crosshair: { mode: "magnet" } }));
    chart.addSeries(CandlestickSeries).setData(bars(200));
    chart.timeScale().fitContent();

    const clicks: Array<{ price: number | null; time: number | null }> = [];
    chart.on("click", (event) => clicks.push({ price: event.price, time: event.time }));

    const root = element.firstElementChild as HTMLElement;
    root.dispatchEvent(pointerEvent("pointerdown", 1, 100, 100));
    root.dispatchEvent(pointerEvent("pointerup", 1, 100, 100));

    chart.startDrawing(HorizontalLine);
    root.dispatchEvent(pointerEvent("pointerdown", 1, 100, 100));
    root.dispatchEvent(pointerEvent("pointerup", 1, 100, 100));

    const anchor = chart.serializeDrawings().drawings[0]?.anchors[0];
    expect(anchor?.price).toBeCloseTo(clicks[0]!.price!, 8);
    expect(anchor?.time).toBe(clicks[0]!.time);
  });

  it("places drawings in empty space after the last bar", () => {
    const element = mount();
    const chart = track(createChart(element));
    const series = chart.addSeries(CandlestickSeries);
    const data = bars(200);
    series.setData(data);
    chart.timeScale().fitContent();
    chart.timeScale().setOptions({ rightOffset: 60 });

    const root = element.firstElementChild as HTMLElement;
    chart.startDrawing(HorizontalLine);
    root.dispatchEvent(pointerEvent("pointerdown", 1, 700, 200));
    root.dispatchEvent(pointerEvent("pointerup", 1, 700, 200));

    const anchor = chart.serializeDrawings().drawings[0]?.anchors[0];
    expect(anchor?.time).toBeGreaterThan(data.at(-1)!.time);
  });

  it("creates drawings with pointer anchors and cancels with Escape", () => {
    const element = mount();
    const chart = track(createChart(element));
    chart.addSeries(CandlestickSeries).setData(bars(50));
    chart.timeScale().fitContent();

    const created: string[] = [];
    const cancelled: string[] = [];
    chart.on("drawing-created", (event) => created.push(event.drawing.toolId));
    chart.on("drawing-cancelled", (event) => cancelled.push(event.toolId));

    const root = element.firstElementChild as HTMLElement;
    chart.startDrawing(HorizontalLine);
    root.dispatchEvent(pointerEvent("pointerdown", 1, 100, 100));

    expect(created).toEqual(["horizontal-line"]);
    expect(chart.serializeDrawings().drawings).toHaveLength(1);
    expect(chart.selectedDrawing()?.toolId).toBe("horizontal-line");

    chart.startDrawing(TrendLine);
    root.dispatchEvent(pointerEvent("pointerdown", 1, 100, 120));
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(cancelled).toEqual(["trend-line"]);
    expect(created).toEqual(["horizontal-line"]);
  });

  it("deletes selected drawings and ignores locked ones", () => {
    const element = mount();
    const chart = track(createChart(element));
    chart.addSeries(CandlestickSeries).setData(bars(50));

    const locked = chart.addDrawing(HorizontalLine, {
      anchors: [{ time: 0, price: 100 }],
      options: { locked: true },
    });
    const removed: string[] = [];
    chart.on("drawing-removed", (event) => removed.push(event.drawingId));

    const root = element.firstElementChild as HTMLElement;
    chart.selectDrawing(locked.id);
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    expect(removed).toEqual([]);
    expect(() => locked.getAnchors()).not.toThrow();

    locked.setOptions({ locked: false });
    chart.selectDrawing(locked.id);
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    expect(removed).toEqual([locked.id]);
    expect(() => locked.getAnchors()).toThrow(/disposed/i);
  });

  it("removes drawings with their pane and keeps auto panes with drawings", () => {
    const chart = track(createChart(mount()));
    chart.addSeries(CandlestickSeries).setData(bars(50));

    const pane = chart.addPane({ height: 120 });
    const drawing = chart.addDrawing(Rectangle, {
      paneId: pane.id,
      anchors: [
        { time: 0, price: 100 },
        { time: 5 * MINUTE, price: 110 },
      ],
    });

    pane.remove();
    expect(() => drawing.getAnchors()).toThrow(/disposed/i);
    expect(chart.serializeDrawings().drawings).toHaveLength(0);

    const indicator = chart.addIndicator(MultiplierIndicator, { pane: "separate" });
    const retained = chart.addDrawing(Measure, {
      paneId: indicator.paneId,
      anchors: [
        { time: 0, price: 100 },
        { time: 5 * MINUTE, price: 105 },
      ],
    });
    indicator.remove();

    expect(() => retained.getAnchors()).not.toThrow();
    expect(chart.serializeDrawings().drawings).toHaveLength(0);
  });

  it("skips unknown tools and panes when loading drawings", () => {
    const chart = track(createChart(mount()));
    chart.addSeries(CandlestickSeries).setData(bars(50));
    const errors: ChartErrorEvent[] = [];
    chart.on("error", (event) => errors.push(event));

    chart.loadDrawings({
      version: 1,
      drawings: [
        {
          id: "missing-tool",
          toolId: "missing",
          paneId: "main",
          anchors: [{ time: 0, price: 100 }],
          options: {},
        },
        {
          id: "missing-pane",
          toolId: "trend-line",
          paneId: "nope",
          anchors: [
            { time: 0, price: 100 },
            { time: 1, price: 101 },
          ],
          options: {},
        },
      ],
    });

    expect(errors.filter((event) => event.source === "drawing")).toHaveLength(2);
    expect(chart.serializeDrawings().drawings).toHaveLength(0);
  });

  it("adds and renders extension overlays", async () => {
    const element = mount();
    const chart = track(createChart(element));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(50));
    chart.timeScale().fitContent();

    const draw = vi.fn();
    const overlay = chart.addOverlay({ id: "test-overlay", draw });
    await settle();

    expect(draw).toHaveBeenCalled();
    const frame = draw.mock.calls.at(-1)?.[1] as {
      paneId: string;
      plot: { width: number };
      visibleRange: { from: number; to: number };
      timeToX(time: number): number | null;
      priceToY(price: number): number;
      yToPrice(y: number): number;
    };
    expect(frame.paneId).toBe("main");
    expect(frame.plot.width).toBeGreaterThan(0);
    expect(frame.timeToX(frame.visibleRange.from)).not.toBeNull();
    expect(frame.priceToY(frame.yToPrice(200))).toBeCloseTo(200);

    overlay.remove();
    draw.mockClear();
    await settle();
    expect(draw).not.toHaveBeenCalled();
  });

  it("rejects duplicate overlays and removes overlays with their pane", async () => {
    const element = mount();
    const chart = track(createChart(element));
    chart.addSeries(CandlestickSeries).setData(bars(50));
    const draw = vi.fn();
    chart.addOverlay({ id: "overlay", draw });
    expect(() => chart.addOverlay({ id: "overlay", draw })).toThrow(/Duplicate overlay/);

    const pane = chart.addPane({ height: 100 });
    const paneDraw = vi.fn();
    chart.addOverlay({ id: "pane-overlay", paneId: pane.id, draw: paneDraw });
    await settle();
    expect(paneDraw).toHaveBeenCalled();

    pane.remove();
    paneDraw.mockClear();
    await settle();
    expect(paneDraw).not.toHaveBeenCalled();
  });

  it("exposes price scale controls", () => {
    const chart = track(createChart(mount()));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(20));

    const scale = series.priceScale();
    scale.setVisibleRange({ min: 50, max: 150 });
    expect(scale.getVisibleRange()).toEqual({ min: 50, max: 150 });

    scale.setAutoScale(true);
  });
});

describe("series price lines and markers", () => {
  it("creates, updates, and removes price lines", async () => {
    const chart = track(createChart(mount()));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(20));

    const line = series.createPriceLine({
      price: 100,
      color: "#ff0000",
      lineStyle: "dashed",
      title: "Entry",
    });
    await settle();
    line.applyOptions({ price: 105, axisLabelVisible: false });
    await settle();
    expect(() => line.applyOptions({ price: Number.NaN })).toThrow(/price line/);

    line.remove();
    await settle();
    expect(() => line.applyOptions({ price: 110 })).not.toThrow();
  });

  it("sets and clears markers", async () => {
    const chart = track(createChart(mount()));
    const series = chart.addSeries(CandlestickSeries);
    series.setData(bars(20));

    series.setMarkers([
      { time: 5 * MINUTE, position: "belowBar", shape: "arrowUp", text: "Buy" },
      { time: 10 * MINUTE, position: "atPriceTop", price: 101, shape: "circle" },
    ]);
    await settle();
    series.setMarkers([]);
    await settle();

    expect(() => series.setMarkers([{ time: 0, position: "atPriceTop" }])).toThrow(
      /require a finite price/,
    );
  });
});

describe("chart screenshots", () => {
  it("composites all canvas layers", async () => {
    const chart = track(createChart(mount()));
    chart.addSeries(CandlestickSeries).setData(bars(20));
    await settle();

    const screenshot = chart.takeScreenshot();
    expect(screenshot).toBeInstanceOf(HTMLCanvasElement);
    expect(screenshot.width).toBeGreaterThan(0);
    expect(screenshot.height).toBeGreaterThan(0);
  });

  it("flushes a pending frame before taking a screenshot", () => {
    const chart = track(createChart(mount()));
    chart.addSeries(CandlestickSeries).setData(bars(20));

    const screenshot = chart.takeScreenshot();
    expect(screenshot.width).toBeGreaterThan(0);
    expect(screenshot.height).toBeGreaterThan(0);
  });

  it("uses the backing-store pixel ratio", () => {
    const original = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", { value: 2, configurable: true });
    try {
      const chart = track(createChart(mount()));
      chart.addSeries(CandlestickSeries).setData(bars(20));
      const screenshot = chart.takeScreenshot();
      expect(screenshot.width).toBe(1600);
      expect(screenshot.height).toBe(800);
    } finally {
      Object.defineProperty(window, "devicePixelRatio", { value: original, configurable: true });
    }
  });

  it("validates data-URL quality", () => {
    const chart = track(createChart(mount()));
    chart.addSeries(CandlestickSeries).setData(bars(20));
    const toDataUrl = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue("data:image/png;base64,test");

    try {
      expect(chart.exportImage()).toBe("data:image/png;base64,test");
      expect(() => chart.exportImage("image/png", 2)).toThrow(/quality/);
    } finally {
      toDataUrl.mockRestore();
    }
  });
});
