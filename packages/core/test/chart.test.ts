import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  CandlestickSeries,
  createChart,
  type ChartApi,
  type ChartErrorEvent,
  type CrosshairEvent,
  type Datafeed,
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

  it("reports unimplemented panes", () => {
    const chart = track(createChart(mount()));
    expect(() => chart.addPane()).toThrow(/Phase 3/);
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
