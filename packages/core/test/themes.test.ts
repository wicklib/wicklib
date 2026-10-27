import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ChartThemes, DarkTheme, LightTheme, createChart } from "../src/index";

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

describe("chart themes", () => {
  it("exposes neutral light and dark presets", () => {
    expect(ChartThemes.light).toBe(LightTheme);
    expect(ChartThemes.dark).toBe(DarkTheme);
    expect(LightTheme.layout.background).toBe("#ffffff");
    expect(DarkTheme.layout.background).toBe("#0b0e14");
    expect(DarkTheme.grid.vertLines.color).toBe("#161b24");
    expect(DarkTheme.crosshair.labelBackground).toBe("#2a2e39");
  });

  it("can be applied at creation and switched without recreating the chart", () => {
    const chart = createChart(mount(), { ...DarkTheme });
    expect(() => chart.setOptions(LightTheme)).not.toThrow();
    expect(() =>
      chart.setOptions({ ...DarkTheme, crosshair: { ...DarkTheme.crosshair } }),
    ).not.toThrow();
    chart.destroy();
  });
});
