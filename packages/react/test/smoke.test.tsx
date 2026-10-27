import { Component, StrictMode, act, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CandlestickSeries, type ChartApi, type WickExtension } from "@wicklib/core";

import { WickChart, useChart } from "../src/index";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root | null;

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

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
      root = null;
      await Promise.resolve();
    });
  }
  host.remove();
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("@wicklib/react", () => {
  it("mounts a chart and exposes it through context", () => {
    const charts: ChartApi[] = [];
    let hookValue: ChartApi | null | undefined;

    function Probe() {
      hookValue = useChart();
      return null;
    }

    act(() => {
      root?.render(
        <WickChart style={{ height: 400 }} onChart={(chart) => charts.push(chart)}>
          <Probe />
        </WickChart>,
      );
    });

    expect(charts).toHaveLength(1);
    expect(charts[0]).toBeDefined();
    expect(hookValue).toBe(charts[0]);
  });

  it("patches chart options without recreating the chart", () => {
    const charts: ChartApi[] = [];
    const onChart = (chart: ChartApi): void => {
      charts.push(chart);
    };

    act(() => {
      root?.render(
        <WickChart style={{ height: 400 }} layout={{ background: "#111111" }} onChart={onChart} />,
      );
    });

    const chart = charts[0];
    expect(chart).toBeDefined();
    if (!chart) {
      return;
    }
    const setOptions = vi.spyOn(chart, "setOptions");

    act(() => {
      root?.render(
        <WickChart style={{ height: 400 }} layout={{ background: "#222222" }} onChart={onChart} />,
      );
    });

    expect(charts).toHaveLength(1);
    expect(setOptions).toHaveBeenCalledWith({ layout: { background: "#222222" } });
  });

  it("recreates the chart when extensions change", async () => {
    const charts: ChartApi[] = [];
    const first = extension("com.test.first");
    const second = extension("com.test.second");
    let hookValue: ChartApi | null | undefined;

    function Probe() {
      hookValue = useChart();
      return null;
    }

    act(() => {
      root?.render(
        <WickChart
          style={{ height: 400 }}
          extensions={[first]}
          onChart={(chart) => charts.push(chart)}
        >
          <Probe />
        </WickChart>,
      );
    });

    await act(async () => {
      root?.render(
        <WickChart
          style={{ height: 400 }}
          extensions={[second]}
          onChart={(chart) => charts.push(chart)}
        >
          <Probe />
        </WickChart>,
      );
      await Promise.resolve();
    });

    expect(charts).toHaveLength(2);
    expect(() => charts[0]?.timeScale()).toThrow(/disposed/i);
    expect(() => charts[1]?.timeScale()).not.toThrow();
    expect(hookValue).toBe(charts[1]);
  });

  it("lets child effects clean up before the chart is destroyed", async () => {
    function Child() {
      const chart = useChart();

      useEffect(() => {
        if (!chart) {
          return;
        }
        const series = chart.addSeries(CandlestickSeries);
        series.setData([
          { time: 0, open: 1, high: 2, low: 0, close: 1 },
          { time: 60_000, open: 1, high: 2, low: 0, close: 1 },
        ]);
        return () => series.remove();
      }, [chart]);

      return null;
    }

    act(() => {
      root?.render(
        <WickChart style={{ height: 400 }}>
          <Child />
        </WickChart>,
      );
    });

    await expect(
      act(async () => {
        root?.unmount();
        root = null;
        await Promise.resolve();
      }),
    ).resolves.toBeUndefined();
  });

  it("lets child effects clean up when extensions recreate the chart", async () => {
    const charts: ChartApi[] = [];

    function Child() {
      const chart = useChart();

      useEffect(() => {
        if (!chart) {
          return;
        }
        const series = chart.addSeries(CandlestickSeries);
        return () => series.remove();
      }, [chart]);

      return null;
    }

    act(() => {
      root?.render(
        <WickChart
          style={{ height: 400 }}
          extensions={[extension("com.test.before")]}
          onChart={(chart) => charts.push(chart)}
        >
          <Child />
        </WickChart>,
      );
    });

    await expect(
      act(async () => {
        root?.render(
          <WickChart
            style={{ height: 400 }}
            extensions={[extension("com.test.after")]}
            onChart={(chart) => charts.push(chart)}
          >
            <Child />
          </WickChart>,
        );
        await Promise.resolve();
      }),
    ).resolves.toBeUndefined();

    expect(charts).toHaveLength(2);
    expect(() => charts[0]?.timeScale()).toThrow(/disposed/i);
    expect(() => charts[1]?.timeScale()).not.toThrow();
  });

  it("destroys the chart on unmount", async () => {
    const charts: ChartApi[] = [];

    act(() => {
      root?.render(<WickChart style={{ height: 400 }} onChart={(chart) => charts.push(chart)} />);
    });

    const chart = charts[0];
    expect(chart).toBeDefined();
    if (!chart) {
      return;
    }

    await act(async () => {
      root?.unmount();
      root = null;
      await Promise.resolve();
    });

    expect(() => chart.timeScale()).toThrow(/disposed/i);
  });

  it("survives StrictMode effects and renders on the server", () => {
    const charts: ChartApi[] = [];

    act(() => {
      root?.render(
        <StrictMode>
          <WickChart style={{ height: 400 }} onChart={(chart) => charts.push(chart)} />
        </StrictMode>,
      );
    });

    expect(charts.length).toBeGreaterThanOrEqual(1);
    expect(() => charts.at(-1)?.timeScale()).not.toThrow();

    const html = renderToString(<WickChart style={{ height: 400 }} />);
    expect(html).toContain("position:relative");
    expect(html).not.toContain("canvas");
  });

  it("throws when useChart is outside a WickChart", () => {
    class Boundary extends Component<{ children: ReactNode }, { message: string | null }> {
      state = { message: null as string | null };

      static getDerivedStateFromError(error: Error) {
        return { message: error.message };
      }

      render() {
        return this.state.message ? <span>{this.state.message}</span> : this.props.children;
      }
    }

    function Outside() {
      useChart();
      return null;
    }

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    act(() => {
      root?.render(
        <Boundary>
          <Outside />
        </Boundary>,
      );
    });

    expect(host.textContent).toContain("useChart must be used within a <WickChart>");
    consoleError.mockRestore();
  });
});

function extension(id: string): WickExtension {
  return {
    kind: "feature",
    meta: {
      id,
      name: id,
      version: "1.0.0",
      license: "free",
    },
  };
}
