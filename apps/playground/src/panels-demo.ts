import {
  AreaSeries,
  CandlestickSeries,
  DarkTheme,
  HistogramSeries,
  LightTheme,
  LineSeries,
  createChart,
  type ChartApi,
  type LineData,
  type OhlcData,
} from "@wicklib/core";

import "./style.css";

declare global {
  interface Window {
    __wicklibPanelsReady?: boolean;
    __wicklibPanels?: readonly ChartApi[];
  }
}

const params = new URLSearchParams(window.location.search);
const webglMode = params.has("webgl");
const MINUTE = 60_000;
const COUNT = 1_200;

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.querySelector<T>(`#${id}`);
  if (!element) {
    throw new Error(`#${id} not found`);
  }
  return element;
};

function candleData(base: number, seed: number): OhlcData[] {
  let price = base;
  return Array.from({ length: COUNT }, (_, index) => {
    const open = price;
    const change = Math.sin(index / 11 + seed) * base * 0.004 + Math.cos(index / 31) * base * 0.002;
    const close = Math.max(1, open + change);
    const high = Math.max(open, close) + base * 0.002;
    const low = Math.min(open, close) - base * 0.002;
    price = close;
    return { time: index * MINUTE, open, high, low, close, volume: 100 + (index % 50) };
  });
}

function lineData(base: number, seed: number): LineData[] {
  return Array.from({ length: COUNT }, (_, index) => ({
    time: index * MINUTE,
    value: base + Math.sin(index / 13 + seed) * base * 0.06 + index * 0.01,
  }));
}

function volumeData(): LineData[] {
  return Array.from({ length: COUNT }, (_, index) => ({
    time: index * MINUTE,
    value: 40 + Math.abs(Math.sin(index / 9)) * 80 + (index % 17),
  }));
}

const charts: ChartApi[] = [];

function panel(name: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-panel="${name}"]`);
  if (!element) {
    throw new Error(`Missing panel: ${name}`);
  }
  return element;
}

function makeChart(container: HTMLElement): ChartApi {
  return createChart(container, {
    autoSize: true,
    ...(webglMode ? { renderer: "webgl2" as const } : {}),
    ...DarkTheme,
    crosshair: { ...DarkTheme.crosshair, mode: "magnet" },
    timeScale: { rightOffset: 4, maxVisibleBars: 500 },
  });
}

const btc = makeChart(panel("candles"));
btc.addSeries(CandlestickSeries, { title: "BTC/USD" }).setData(candleData(65_000, 1));
charts.push(btc);

const eth = makeChart(panel("line"));
eth
  .addSeries(LineSeries, { title: "ETH/USD", color: "#2962ff", lineWidth: 2 })
  .setData(lineData(3_200, 2));
charts.push(eth);

const sol = makeChart(panel("area"));
sol
  .addSeries(AreaSeries, {
    title: "SOL/USD",
    color: "#10b981",
    lineColor: "#10b981",
    topColor: "rgba(16,185,129,0.35)",
    bottomColor: "rgba(16,185,129,0)",
  })
  .setData(lineData(150, 4));
charts.push(sol);

const volume = makeChart(panel("histogram"));
volume
  .addSeries(HistogramSeries, {
    title: "Volume",
    color: "#f59e0b",
    base: 0,
  })
  .setData(volumeData());
charts.push(volume);

for (const chart of charts) {
  chart.timeScale().fitContent();
}

const summary = byId<HTMLSpanElement>("summary");
summary.textContent = `${charts.length} panels · ${webglMode ? "WebGL2" : "Canvas2D"}`;

let dark = true;
const themeButton = byId<HTMLButtonElement>("theme");
themeButton.addEventListener("click", () => {
  dark = !dark;
  const theme = dark ? DarkTheme : LightTheme;
  for (const chart of charts) {
    chart.setOptions({
      ...theme,
      crosshair: { ...theme.crosshair, mode: "magnet" },
    });
  }
  document.body.dataset.theme = dark ? "dark" : "light";
  themeButton.textContent = dark ? "Light" : "Dark";
});

byId<HTMLButtonElement>("back").addEventListener("click", () => {
  window.location.href = "/";
});

document.body.dataset.theme = "dark";
window.__wicklibPanels = charts;
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    window.__wicklibPanelsReady = true;
  });
});
