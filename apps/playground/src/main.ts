import { CandlestickSeries, createChart, type OhlcData } from "@wicklib/core";

import { generateOhlc } from "./data";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app not found");
}

app.innerHTML = `
  <header class="toolbar">
    <div class="brand">wicklib <span>playground</span></div>
    <div class="controls">
      <label>Bars
        <select id="count">
          <option value="5000">5,000</option>
          <option value="25000">25,000</option>
          <option value="100000" selected>100,000</option>
        </select>
      </label>
      <button id="regenerate" type="button">Regenerate</button>
      <button id="fit" type="button">Fit</button>
      <button id="theme" type="button">Light</button>
    </div>
    <div class="metrics"><span id="fps">— fps</span></div>
  </header>
  <div class="status">
    <span id="summary"></span>
    <span id="readout"></span>
  </div>
  <div id="chart"></div>
`;

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.querySelector<T>(`#${id}`);
  if (!element) {
    throw new Error(`#${id} not found`);
  }
  return element;
};

const chartElement = byId<HTMLDivElement>("chart");
const summary = byId<HTMLSpanElement>("summary");
const readout = byId<HTMLSpanElement>("readout");
const fps = byId<HTMLSpanElement>("fps");
const countSelect = byId<HTMLSelectElement>("count");
const regenerateButton = byId<HTMLButtonElement>("regenerate");
const fitButton = byId<HTMLButtonElement>("fit");
const themeButton = byId<HTMLButtonElement>("theme");

const chart = createChart(chartElement, {
  autoSize: true,
  layout: { background: "#0b0e14", textColor: "#d1d4dc" },
  grid: {
    vertLines: { color: "#161b24" },
    horzLines: { color: "#161b24" },
  },
  crosshair: {
    mode: "magnet",
    labelBackground: "#2a2e39",
  },
  timeScale: {
    rightOffset: 4,
    barSpacing: 6,
  },
  priceScale: {
    scaleMargins: { top: 0.12, bottom: 0.12 },
  },
});

const series = chart.addSeries(CandlestickSeries, {
  title: "BTC/USD",
  upColor: "#26a69a",
  downColor: "#ef5350",
  wickUpColor: "#26a69a",
  wickDownColor: "#ef5350",
});

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

let count = 100_000;
let seed = 7;
let data: OhlcData[] = [];

function format(value: number): string {
  return value.toFixed(2);
}

function findBar(time: number): OhlcData | null {
  let low = 0;
  let high = data.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const bar = data[mid]!;
    if (bar.time === time) {
      return bar;
    }
    if (bar.time < time) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return null;
}

function updateSummary(): void {
  const range = chart.timeScale().getVisibleRange();
  const from = range.from > 0 ? dayFormatter.format(range.from) : "—";
  const to = range.to > 0 ? dayFormatter.format(range.to) : "—";

  summary.textContent = `BTC/USD · 1m · ${data.length.toLocaleString("en-US")} bars · ${from} → ${to}`;
}

function load(): void {
  data = generateOhlc(count, seed);
  series.setData(data);
  chart.timeScale().fitContent();
  updateSummary();
}

chart.on("visible-range", () => {
  updateSummary();
});

chart.on("crosshair", (event) => {
  if (event.time === null) {
    readout.textContent = "";
    return;
  }

  const bar = findBar(event.time);
  if (!bar) {
    readout.textContent = timeFormatter.format(event.time);
    return;
  }

  readout.textContent = `O ${format(bar.open)}  H ${format(bar.high)}  L ${format(bar.low)}  C ${format(bar.close)}`;
});

countSelect.addEventListener("change", () => {
  count = Number(countSelect.value);
  seed += 1;
  load();
});

regenerateButton.addEventListener("click", () => {
  seed += 1;
  load();
});

fitButton.addEventListener("click", () => {
  chart.timeScale().fitContent();
});

let dark = true;

themeButton.addEventListener("click", () => {
  dark = !dark;

  if (dark) {
    chart.setOptions({
      layout: { background: "#0b0e14", textColor: "#d1d4dc" },
      grid: {
        vertLines: { color: "#161b24" },
        horzLines: { color: "#161b24" },
      },
    });
    document.body.dataset.theme = "dark";
    themeButton.textContent = "Light";
  } else {
    chart.setOptions({
      layout: { background: "#ffffff", textColor: "#131722" },
      grid: {
        vertLines: { color: "#eef0f3" },
        horzLines: { color: "#eef0f3" },
      },
    });
    document.body.dataset.theme = "light";
    themeButton.textContent = "Dark";
  }
});

let frames = 0;
let lastFrame = performance.now();

function tick(now: number): void {
  frames += 1;
  if (now - lastFrame >= 500) {
    fps.textContent = `${Math.round((frames * 1000) / (now - lastFrame))} fps`;
    frames = 0;
    lastFrame = now;
  }
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

document.body.dataset.theme = "dark";
load();
