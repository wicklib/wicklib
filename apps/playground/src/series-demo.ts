import {
  AreaSeries,
  DarkTheme,
  HistogramSeries,
  LightTheme,
  LineSeries,
  createChart,
  type ChartApi,
  type LineData,
} from "@wicklib/core";

import "./style.css";

declare global {
  interface Window {
    __wicklibSeriesReady?: boolean;
    __wicklibSeriesChart?: ChartApi;
  }
}

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.querySelector<T>(`#${id}`);
  if (!element) {
    throw new Error(`#${id} not found`);
  }
  return element;
};

const chartElement = byId<HTMLDivElement>("chart");
const summary = byId<HTMLSpanElement>("summary");
const themeButton = byId<HTMLButtonElement>("theme");
const snapshotButton = byId<HTMLButtonElement>("snapshot");
const backButton = byId<HTMLButtonElement>("back");
const COUNT = 140;
const MINUTE = 60_000;

const times = Array.from({ length: COUNT }, (_, index) => index * MINUTE);
const price: LineData[] = times.map((time, index) => ({
  time,
  value: 100 + index * 0.32 + Math.sin(index / 7) * 7 + Math.sin(index / 19) * 3,
}));
const momentum: LineData[] = times.map((time, index) => ({
  time,
  value: Math.sin(index / 9) * 12 + Math.cos(index / 17) * 5,
}));
const delta: LineData[] = times.map((time, index) => ({
  time,
  value: index === 0 ? 0 : price[index]!.value - price[index - 1]!.value,
}));

const chart = createChart(chartElement, {
  autoSize: true,
  ...DarkTheme,
  crosshair: { ...DarkTheme.crosshair, mode: "magnet" },
  timeScale: { rightOffset: 4, timeVisible: true, secondsVisible: false },
});

const areaPane = chart.addPane({ height: 170 });
const histogramPane = chart.addPane({ height: 140 });

const line = chart.addSeries(LineSeries, {
  title: "Price line",
  color: "#10b981",
  lineWidth: 2,
});
const area = chart.addSeries(AreaSeries, {
  title: "Momentum area",
  paneId: areaPane.id,
  color: "#2962ff",
  lineColor: "#2962ff",
  topColor: "rgba(41,98,255,0.38)",
  bottomColor: "rgba(41,98,255,0)",
});
const histogram = chart.addSeries(HistogramSeries, {
  title: "Delta histogram",
  paneId: histogramPane.id,
  color: "#f59e0b",
  base: 0,
});

line.setData(price);
area.setData(momentum);
histogram.setData(delta);
line.createPriceLine({
  price: 125,
  color: "#10b981",
  lineWidth: 1,
  lineStyle: "dashed",
  title: "Entry",
  titlePosition: "plot",
});
line.createPriceLine({
  price: 155,
  color: "#f43f5e",
  lineWidth: 1,
  lineStyle: "dotted",
  title: "Exit",
  titlePosition: "plot",
});
line.setMarkers([
  { time: times[24]!, position: "belowBar", shape: "arrowUp", color: "#10b981", text: "Buy" },
  { time: times[92]!, position: "aboveBar", shape: "arrowDown", color: "#f43f5e", text: "Sell" },
]);
chart.timeScale().fitContent();

summary.textContent = `${line.id} / ${area.id} / ${histogram.id} · price lines + markers`;

let dark = true;
themeButton.addEventListener("click", () => {
  dark = !dark;
  const theme = dark ? DarkTheme : LightTheme;
  chart.setOptions({
    ...theme,
    crosshair: { ...theme.crosshair, mode: "magnet" },
  });
  document.body.dataset.theme = dark ? "dark" : "light";
  themeButton.textContent = dark ? "Light" : "Dark";
});

snapshotButton.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "wicklib-series-demo.png";
  link.href = chart.exportImage("image/png");
  link.click();
});

backButton.addEventListener("click", () => {
  window.location.href = "/";
});

document.body.dataset.theme = "dark";
window.__wicklibSeriesChart = chart;
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    window.__wicklibSeriesReady = true;
  });
});
