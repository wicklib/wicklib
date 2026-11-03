import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { CandlestickSeries, type OhlcData } from "@wicklib/core";

import { createChartLayout, type ChartLayoutSlot } from "../src/index";

const MINUTE = 60_000;
const containers: HTMLElement[] = [];

function mount(): HTMLElement {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientWidth", { value: 1000, configurable: true });
  Object.defineProperty(element, "clientHeight", { value: 700, configurable: true });
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
    close: 101 + index,
  }));
}

function sizeSlot(slot: ChartLayoutSlot): void {
  Object.defineProperty(slot.element, "clientWidth", { value: 500, configurable: true });
  Object.defineProperty(slot.element, "clientHeight", { value: 350, configurable: true });
  slot.chart.resize();
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

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
  while (containers.length > 0) {
    containers.pop()?.remove();
  }
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("createChartLayout", () => {
  it("creates a grid and tracks the active chart", async () => {
    const layout = createChartLayout(mount(), { columns: 2, gap: 8 });
    const first = layout.addChart({ id: "primary" });
    const second = layout.addChart({ id: "comparison" });
    sizeSlot(first);
    sizeSlot(second);
    await settle();

    expect(layout.chartIds()).toEqual(["primary", "comparison"]);
    expect(layout.activeChartId()).toBe("primary");
    expect(first.element.dataset.active).toBe("true");
    expect(second.element.dataset.active).toBeUndefined();
    expect(layout.element.style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
    expect(layout.element.style.gap).toBe("8px");

    const active = vi.fn();
    const unsubscribe = layout.onActiveChange(active);
    layout.setActiveChart("comparison");
    expect(layout.activeChartId()).toBe("comparison");
    expect(first.element.dataset.active).toBeUndefined();
    expect(second.element.dataset.active).toBe("true");
    expect(active).toHaveBeenCalledWith("comparison");

    unsubscribe();
    layout.setActiveChart("primary");
    expect(active).toHaveBeenCalledTimes(1);

    layout.destroy();
  });

  it("synchronizes visible time ranges", async () => {
    const layout = createChartLayout(mount(), { columns: 2 });
    const first = layout.addChart({ id: "a" });
    const second = layout.addChart({ id: "b" });
    sizeSlot(first);
    sizeSlot(second);
    first.chart.addSeries(CandlestickSeries).setData(bars());
    second.chart.addSeries(CandlestickSeries).setData(bars());
    await settle();

    first.chart.timeScale().setVisibleRange({ from: 10 * MINUTE, to: 30 * MINUTE });

    expect(second.chart.timeScale().getVisibleRange()).toEqual({
      from: 10 * MINUTE,
      to: 30 * MINUTE,
    });

    layout.destroy();
  });

  it("can disable time-range synchronization", async () => {
    const layout = createChartLayout(mount(), { columns: 2, syncTimeRange: false });
    const first = layout.addChart({ id: "a" });
    const second = layout.addChart({ id: "b" });
    sizeSlot(first);
    sizeSlot(second);
    first.chart.addSeries(CandlestickSeries).setData(bars());
    second.chart.addSeries(CandlestickSeries).setData(bars());
    second.chart.timeScale().setVisibleRange({ from: 0, to: 50 * MINUTE });
    await settle();

    const before = second.chart.timeScale().getVisibleRange();
    first.chart.timeScale().setVisibleRange({ from: 10 * MINUTE, to: 30 * MINUTE });
    expect(second.chart.timeScale().getVisibleRange()).toEqual(before);

    layout.destroy();
  });

  it("serializes structure, removes charts, and disposes charts", async () => {
    const layout = createChartLayout(mount(), { columns: 3, gap: 4 });
    const first = layout.addChart({
      id: "primary",
      rowSpan: 2,
      columnSpan: 2,
      chartOptions: { locale: "en-US" },
    });
    const second = layout.addChart({ id: "secondary" });
    sizeSlot(first);
    sizeSlot(second);
    await settle();

    expect(layout.serialize()).toEqual({
      version: 1,
      columns: 3,
      gap: 4,
      slots: [
        { id: "primary", rowSpan: 2, columnSpan: 2 },
        { id: "secondary", rowSpan: 1, columnSpan: 1 },
      ],
    });

    const destroy = vi.spyOn(second.chart, "destroy");
    layout.removeChart("secondary");
    expect(destroy).toHaveBeenCalledOnce();
    expect(layout.getChart("secondary")).toBeNull();
    expect(layout.chartIds()).toEqual(["primary"]);

    layout.destroy();
    expect(() => layout.chartIds()).toThrow(/disposed/);
    expect(() => layout.addChart()).toThrow(/disposed/);
  });

  it("validates grid options and slot ids", () => {
    expect(() => createChartLayout(mount(), { columns: 0 })).toThrow(/columns/);
    expect(() => createChartLayout(mount(), { columns: 13 })).toThrow(/columns/);
    expect(() => createChartLayout(mount(), { gap: -1 })).toThrow(/gap/);

    const layout = createChartLayout(mount());
    layout.addChart({ id: "same" });
    expect(() => layout.addChart({ id: "same" })).toThrow(/Duplicate/);
    expect(() => layout.setActiveChart("missing")).toThrow(/Unknown/);
    layout.destroy();
  });
});
