import {
  CandlestickSeries,
  createChart,
  FibRetracement,
  HorizontalLine,
  Rectangle,
  TrendLine,
  type DrawingToolDefinition,
  type OhlcData,
} from "@wicklib/core";
import { ATR, BollingerBands, EMA, MACD, RSI, SMA, VWAP } from "@wicklib/indicators";

import { generateOhlc } from "./data";
import { createMockFeed } from "./mock-feed";
import "./style.css";

interface BenchResult {
  frames: number;
  medianMs: number;
  p95Ms: number;
  fps: number;
}

interface BinanceSnapshot {
  version: number;
  source: string;
  market: string;
  symbol: string;
  interval: string;
  year: string;
  bars: number[][];
}

declare global {
  interface Window {
    __wicklibReady?: boolean;
    __wicklibBench?: BenchResult;
  }
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app not found");
}

const params = new URLSearchParams(window.location.search);
const testMode = params.has("test");
const benchMode = params.has("bench");

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
      <button id="feed" type="button">Use feed</button>
      <button id="binance" type="button">Binance 2025</button>
      <button id="fit" type="button">Fit</button>
      <label class="toggle"><input id="sma" type="checkbox" /> SMA</label>
      <label class="toggle"><input id="rsi" type="checkbox" /> RSI</label>
      <label class="toggle"><input id="macd" type="checkbox" /> MACD</label>
      <span class="divider" aria-hidden="true"></span>
      <button type="button" data-drawing="trend-line" title="Trend line">Trend</button>
      <button type="button" data-drawing="horizontal-line" title="Horizontal line">H-Line</button>
      <button type="button" data-drawing="rectangle" title="Rectangle">Rect</button>
      <button type="button" data-drawing="fib-retracement" title="Fibonacci retracement">Fib</button>
      <button id="clear-drawings" type="button">Clear</button>
      <button id="theme" type="button">Light</button>
    </div>
    <div class="metrics"><span id="fps">— fps</span></div>
  </header>
  <div class="status">
    <span id="summary"></span>
    <span id="feed-status"></span>
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
if (testMode || benchMode) {
  chartElement.style.height = "640px";
  chartElement.style.flex = "none";
}
const summary = byId<HTMLSpanElement>("summary");
const readout = byId<HTMLSpanElement>("readout");
const fps = byId<HTMLSpanElement>("fps");
const countSelect = byId<HTMLSelectElement>("count");
const regenerateButton = byId<HTMLButtonElement>("regenerate");
const feedButton = byId<HTMLButtonElement>("feed");
const binanceButton = byId<HTMLButtonElement>("binance");
const feedStatus = byId<HTMLSpanElement>("feed-status");
const fitButton = byId<HTMLButtonElement>("fit");
const smaToggle = byId<HTMLInputElement>("sma");
const rsiToggle = byId<HTMLInputElement>("rsi");
const macdToggle = byId<HTMLInputElement>("macd");
const themeButton = byId<HTMLButtonElement>("theme");
const clearDrawingsButton = byId<HTMLButtonElement>("clear-drawings");

const drawingTools: Record<string, DrawingToolDefinition> = {
  "trend-line": TrendLine,
  "horizontal-line": HorizontalLine,
  rectangle: Rectangle,
  "fib-retracement": FibRetracement,
};
const drawingButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-drawing]"));

function setActiveDrawingButton(toolId: string | null): void {
  for (const button of drawingButtons) {
    button.classList.toggle("active", button.dataset.drawing === toolId);
  }
}

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
    maxVisibleBars: 720,
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
let feedActive = false;
let fitAfterFeedLoad = false;
let binanceLabel: string | null = null;

interface IndicatorHandle {
  remove(): void;
}

let smaIndicator: IndicatorHandle | null = null;
let rsiIndicator: IndicatorHandle | null = null;
let macdIndicator: IndicatorHandle | null = null;

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
  const formatter = range.to - range.from <= 2 * 86_400_000 ? timeFormatter : dayFormatter;
  const from = range.from > 0 ? formatter.format(range.from) : "—";
  const to = range.to > 0 ? formatter.format(range.to) : "—";

  const label = feedActive
    ? "live feed"
    : (binanceLabel ?? `${data.length.toLocaleString("en-US")} bars`);
  summary.textContent = `BTC/USDT · 1m · ${label} · ${from} → ${to}`;
}

function stopFeed(): void {
  if (!feedActive) {
    return;
  }
  feedActive = false;
  series.clearDatafeed();
  feedStatus.textContent = "";
}

function startFeed(): void {
  binanceButton.classList.remove("active");
  feedActive = true;
  fitAfterFeedLoad = true;
  feedStatus.textContent = "loading…";
  series.setDatafeed(
    createMockFeed(() => data),
    {
      symbol: "BTC/USD",
      interval: "1m",
      initialBars: 2000,
    },
  );
}

function setIndicator(kind: "sma" | "rsi" | "macd", enabled: boolean): void {
  if (kind === "sma") {
    if (enabled && !smaIndicator) {
      smaIndicator = chart.addIndicator(SMA, {
        inputs: { period: 50, source: "close" },
      });
    } else if (!enabled && smaIndicator) {
      smaIndicator.remove();
      smaIndicator = null;
    }
    return;
  }

  if (kind === "rsi") {
    if (enabled && !rsiIndicator) {
      rsiIndicator = chart.addIndicator(RSI, {
        inputs: { period: 14, source: "close" },
      });
    } else if (!enabled && rsiIndicator) {
      rsiIndicator.remove();
      rsiIndicator = null;
    }
    return;
  }

  if (enabled && !macdIndicator) {
    macdIndicator = chart.addIndicator(MACD);
  } else if (!enabled && macdIndicator) {
    macdIndicator.remove();
    macdIndicator = null;
  }
}

function enableDemoIndicators(): void {
  smaToggle.checked = true;
  rsiToggle.checked = true;
  macdToggle.checked = true;
  setIndicator("sma", true);
  setIndicator("rsi", true);
  setIndicator("macd", true);
}

function addBenchmarkIndicators(): void {
  chart.addIndicator(SMA, { inputs: { period: 50, source: "close" } });
  chart.addIndicator(EMA, { inputs: { period: 20, source: "close" } });
  chart.addIndicator(RSI, { inputs: { period: 14, source: "close" } });
  chart.addIndicator(MACD);
  chart.addIndicator(BollingerBands);
  chart.addIndicator(VWAP);
  chart.addIndicator(ATR);
}

function load(): void {
  const wasFeed = feedActive;
  if (wasFeed) {
    stopFeed();
  }
  binanceLabel = null;
  binanceButton.classList.remove("active");

  data = generateOhlc(count, seed);

  if (wasFeed) {
    startFeed();
  } else {
    series.setData(data);
    chart.timeScale().fitContent();
  }

  updateSummary();
}

async function loadBinance(): Promise<void> {
  if (feedActive) {
    stopFeed();
    feedButton.textContent = "Use feed";
  }

  binanceButton.disabled = true;
  feedStatus.textContent = "loading Binance…";

  try {
    const response = await fetch("/data/binance-btcusdt-1m-2025.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const snapshot = (await response.json()) as BinanceSnapshot;
    const bars = parseBinanceSnapshot(snapshot);
    data = bars;
    binanceLabel = `Binance ${snapshot.market} ${snapshot.symbol} ${snapshot.year} · ${snapshot.interval}`;
    binanceButton.classList.add("active");
    series.setData(data);
    chart.timeScale().fitContent();
    updateSummary();
    feedStatus.textContent = `${bars.length.toLocaleString("en-US")} bars`;
  } catch (error) {
    console.error("Could not load the local Binance snapshot", error);
    feedStatus.textContent = "Binance snapshot missing — run data:binance";
  } finally {
    binanceButton.disabled = false;
  }
}

function parseBinanceSnapshot(snapshot: BinanceSnapshot): OhlcData[] {
  if (snapshot.version !== 1 || !Array.isArray(snapshot.bars)) {
    throw new Error("Unsupported Binance snapshot");
  }

  let previousTime = Number.NEGATIVE_INFINITY;
  const bars: OhlcData[] = new Array(snapshot.bars.length);

  for (let index = 0; index < snapshot.bars.length; index += 1) {
    const row = snapshot.bars[index];
    if (!Array.isArray(row) || row.length < 6) {
      throw new Error(`Malformed Binance bar at index ${index}`);
    }

    const time = Number(row[0]);
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    const volume = Number(row[5]);
    if (
      !Number.isFinite(time) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close) ||
      !Number.isFinite(volume)
    ) {
      throw new Error(`Non-finite Binance bar at index ${index}`);
    }
    if (time <= previousTime) {
      throw new Error(`Unsorted Binance bar at index ${index}`);
    }

    bars[index] = { time, open, high, low, close, volume };
    previousTime = time;
  }

  if (bars.length === 0) {
    throw new Error("The Binance snapshot is empty");
  }

  return bars;
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
}

function markReady(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__wicklibReady = true;
    });
  });
}

async function runBenchmark(): Promise<void> {
  addBenchmarkIndicators();
  chart.timeScale().fitContent();
  await nextFrame();
  await nextFrame();

  const samples: number[] = [];
  let previous = performance.now();

  for (let index = 0; index < 180; index += 1) {
    const now = await nextFrame();
    samples.push(now - previous);
    previous = now;

    const range = chart.timeScale().getVisibleRange();
    const step = (range.to - range.from) * 0.0001;
    chart.timeScale().setVisibleRange({
      from: range.from + step,
      to: range.to + step,
    });
  }

  samples.shift();
  samples.sort((first, second) => first - second);

  const median = samples[Math.floor(samples.length * 0.5)]!;
  const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))]!;
  const result: BenchResult = {
    frames: samples.length,
    medianMs: median,
    p95Ms: p95,
    fps: 1000 / median,
  };

  window.__wicklibBench = result;
  window.__wicklibReady = true;
  feedStatus.textContent = `${result.fps.toFixed(1)} fps · p95 ${p95.toFixed(1)} ms`;
  console.log("WICKLIB_BENCH", JSON.stringify(result));
}

chart.on("visible-range", () => {
  updateSummary();
});

chart.on("data-loading", (event) => {
  if (event.loading) {
    feedStatus.textContent = "loading…";
    return;
  }

  feedStatus.textContent = feedActive ? "live" : "";

  if (fitAfterFeedLoad) {
    fitAfterFeedLoad = false;
    chart.timeScale().fitContent();
  }
});

chart.on("error", (event) => {
  if (event.source === "datafeed") {
    feedStatus.textContent = "feed error";
  }
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

smaToggle.addEventListener("change", () => {
  setIndicator("sma", smaToggle.checked);
});

rsiToggle.addEventListener("change", () => {
  setIndicator("rsi", rsiToggle.checked);
});

macdToggle.addEventListener("change", () => {
  setIndicator("macd", macdToggle.checked);
});

feedButton.addEventListener("click", () => {
  if (feedActive) {
    stopFeed();
    series.setData(data);
    chart.timeScale().fitContent();
    feedButton.textContent = "Use feed";
    binanceButton.classList.toggle("active", binanceLabel !== null);
  } else {
    startFeed();
    feedButton.textContent = "Use static";
  }
  updateSummary();
});

binanceButton.addEventListener("click", () => {
  void loadBinance();
});

fitButton.addEventListener("click", () => {
  chart.timeScale().fitContent();
});

for (const button of drawingButtons) {
  button.addEventListener("click", () => {
    const tool = drawingTools[button.dataset.drawing ?? ""];
    if (!tool) {
      return;
    }
    chart.startDrawing(tool);
    setActiveDrawingButton(tool.id);
  });
}

clearDrawingsButton.addEventListener("click", () => {
  chart.loadDrawings({ version: 1, drawings: [] });
  setActiveDrawingButton(null);
});

chart.on("drawing-created", () => {
  setActiveDrawingButton(null);
});

chart.on("drawing-cancelled", () => {
  setActiveDrawingButton(null);
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

if (!testMode && !benchMode) {
  requestAnimationFrame(tick);
}

function addDemoDrawings(): void {
  if (data.length === 0) {
    return;
  }

  const barBefore = (bars: number): OhlcData => {
    const index = Math.max(0, data.length - 1 - bars);
    return data[index]!;
  };

  const trendStart = barBefore(680);
  const trendEnd = barBefore(500);
  const rectangleStart = barBefore(420);
  const rectangleEnd = barBefore(260);
  const fibStart = barBefore(220);
  const fibEnd = barBefore(80);
  const horizontal = barBefore(340);

  chart.addDrawing(TrendLine, {
    anchors: [
      { time: trendStart.time, price: trendStart.low },
      { time: trendEnd.time, price: trendEnd.high },
    ],
    options: { color: "#f0b90b", lineWidth: 2 },
  });
  const rectangle = chart.addDrawing(Rectangle, {
    anchors: [
      { time: rectangleStart.time, price: rectangleEnd.high },
      { time: rectangleEnd.time, price: rectangleStart.low },
    ],
    options: { color: "#2962ff", fillColor: "#2962ff", fillOpacity: 0.14 },
  });
  chart.addDrawing(HorizontalLine, {
    anchors: [{ time: horizontal.time, price: horizontal.close }],
    options: { color: "#26a69a", lineStyle: "dashed" },
  });
  chart.addDrawing(FibRetracement, {
    anchors: [
      { time: fibStart.time, price: fibStart.low },
      { time: fibEnd.time, price: fibEnd.high },
    ],
    options: { color: "#787b86" },
  });
  chart.selectDrawing(rectangle.id);
}

document.body.dataset.theme = "dark";
load();

if (params.has("feed")) {
  startFeed();
  feedButton.textContent = "Use static";
  updateSummary();
}

if (params.has("indicators")) {
  enableDemoIndicators();
}

if (params.has("drawings")) {
  addDemoDrawings();
}

if (params.has("binance")) {
  void loadBinance();
}

if (testMode) {
  markReady();
}

if (benchMode) {
  void runBenchmark();
}
