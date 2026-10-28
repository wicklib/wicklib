import {
  CandlestickSeries,
  createChart,
  DarkTheme,
  FibRetracement,
  HorizontalLine,
  LightTheme,
  Rectangle,
  TrendLine,
  type ChartApi,
  type DrawingToolDefinition,
  type OhlcData,
} from "@wicklib/core";
import { ATR, BollingerBands, EMA, MACD, RSI, SMA, VWAP } from "@wicklib/indicators";

import { US_EQUITIES_RTH, generateOhlc, generateSessionOhlc } from "./data";
import { createMockFeed } from "./mock-feed";
import "./style.css";

interface BenchResult {
  frames: number;
  medianMs: number;
  p95Ms: number;
  fps: number;
}

type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const TIMEFRAME_MINUTES: Record<Timeframe, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1d": 1_440,
};

const RIGHT_MARGIN_BARS = 30;
const MAX_VISIBLE_BARS = 720;
const SESSION_VISIBLE_BARS = 900;
const SPX_VISIBLE_BARS = 1_400;

interface SnapshotBars {
  version: number;
  bars: number[][];
}

interface BinanceSnapshot extends SnapshotBars {
  source: string;
  market: string;
  symbol: string;
  interval: string;
  year: string;
}

interface YahooSnapshot extends SnapshotBars {
  source: string;
  symbol: string;
  interval: string;
  range: string;
  timezone: string;
}

declare global {
  interface Window {
    __wicklibReady?: boolean;
    __wicklibBench?: BenchResult;
    __wicklibChart?: ChartApi;
  }
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app not found");
}

const params = new URLSearchParams(window.location.search);
const testMode = params.has("test");
const benchParam = params.get("bench");
const benchMode = benchParam !== null;
const zoomBench = benchParam === "zoom";

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
      <label>TF
        <select id="timeframe">
          <option value="1m" selected>1m</option>
          <option value="5m">5m</option>
          <option value="15m">15m</option>
          <option value="1h">1h</option>
          <option value="4h">4h</option>
          <option value="1d">1d</option>
        </select>
      </label>
      <button id="regenerate" type="button">Regenerate</button>
      <button id="feed" type="button">Use feed</button>
      <button id="binance" type="button">Binance 2025</button>
      <button id="spx" type="button">SPX 5m</button>
      <button id="series-demo" type="button">Series demo</button>
      <button id="fit" type="button">Fit</button>
      <button id="reset" type="button">Reset</button>
      <label class="toggle"><input id="sma" type="checkbox" /> SMA</label>
      <label class="toggle"><input id="rsi" type="checkbox" /> RSI</label>
      <label class="toggle"><input id="macd" type="checkbox" /> MACD</label>
      <span class="divider" aria-hidden="true"></span>
      <button type="button" data-drawing="trend-line" title="Trend line">Trend</button>
      <button type="button" data-drawing="horizontal-line" title="Horizontal line">H-Line</button>
      <button type="button" data-drawing="rectangle" title="Rectangle">Rect</button>
      <button type="button" data-drawing="fib-retracement" title="Fibonacci retracement">Fib</button>
      <button id="clear-drawings" type="button" title="Select a drawing, then press Delete or Backspace. Clear removes all.">Clear</button>
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
const timeframeSelect = byId<HTMLSelectElement>("timeframe");
const regenerateButton = byId<HTMLButtonElement>("regenerate");
const feedButton = byId<HTMLButtonElement>("feed");
const binanceButton = byId<HTMLButtonElement>("binance");
const spxButton = byId<HTMLButtonElement>("spx");
const feedStatus = byId<HTMLSpanElement>("feed-status");
const fitButton = byId<HTMLButtonElement>("fit");
const resetButton = byId<HTMLButtonElement>("reset");
const smaToggle = byId<HTMLInputElement>("sma");
const rsiToggle = byId<HTMLInputElement>("rsi");
const macdToggle = byId<HTMLInputElement>("macd");
const themeButton = byId<HTMLButtonElement>("theme");
const clearDrawingsButton = byId<HTMLButtonElement>("clear-drawings");
const seriesDemoButton = byId<HTMLButtonElement>("series-demo");

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
  ...DarkTheme,
  crosshair: {
    ...DarkTheme.crosshair,
    mode: "magnet",
  },
  timeScale: {
    rightOffset: 4,
    barSpacing: 6,
    maxVisibleBars: MAX_VISIBLE_BARS,
  },
  priceScale: {
    scaleMargins: { top: 0.12, bottom: 0.12 },
  },
});

if (testMode) {
  window.__wicklibChart = chart;
}

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

const newYorkDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "short",
  day: "numeric",
});

const newYorkTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

let count = 100_000;
let seed = 7;
let timeframe: Timeframe = "1m";
let sourceMinutes = 1;
let baseData: OhlcData[] = [];
let data: OhlcData[] = [];
let feedActive = false;
let fitAfterFeedLoad = false;
let instrumentLabel = "BTC/USDT";
let summaryTimezone = "UTC";
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
  const shortRange = range.to - range.from <= 2 * 86_400_000;
  const formatter =
    summaryTimezone === "America/New_York"
      ? shortRange
        ? newYorkTimeFormatter
        : newYorkDayFormatter
      : shortRange
        ? timeFormatter
        : dayFormatter;
  const from = range.from > 0 ? formatter.format(range.from) : "—";
  const to = range.to > 0 ? formatter.format(range.to) : "—";

  const label = feedActive
    ? "live feed"
    : (binanceLabel ?? `${data.length.toLocaleString("en-US")} bars`);
  const interval = feedActive ? "1m" : timeframe;
  summary.textContent = `${instrumentLabel} · ${interval} · ${label} · ${from} → ${to}`;
}

function stopFeed(): void {
  if (!feedActive) {
    return;
  }
  feedActive = false;
  timeframeSelect.disabled = false;
  series.clearDatafeed();
  feedStatus.textContent = "";
}

function startFeed(): void {
  if (sourceMinutes !== 1) {
    sourceMinutes = 1;
    timeframe = "1m";
    timeframeSelect.value = "1m";
    timeframeSelect.disabled = false;
    baseData = generateOhlc(count, seed);
  }
  instrumentLabel = "BTC/USDT";
  summaryTimezone = "UTC";
  series.setOptions({ title: "BTC/USD" });
  chart.timeScale().setOptions({
    calendar: null,
    gapMode: "compress",
    maxVisibleBars: MAX_VISIBLE_BARS,
  });
  if (timeframe !== "1m") {
    timeframe = "1m";
    timeframeSelect.value = "1m";
    applyTimeframe();
  }
  timeframeSelect.disabled = true;
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
  instrumentLabel = "BTC/USDT";
  summaryTimezone = "UTC";
  sourceMinutes = 1;
  timeframeSelect.disabled = false;
  series.setOptions({ title: "BTC/USD" });
  binanceButton.classList.remove("active");
  spxButton.classList.remove("active");
  chart.timeScale().setOptions({
    calendar: null,
    gapMode: "compress",
    maxVisibleBars: MAX_VISIBLE_BARS,
  });
  baseData = generateOhlc(count, seed);

  if (wasFeed) {
    startFeed();
  } else {
    applyTimeframe();
  }
}

function applyTimeframe(): void {
  const targetMinutes = TIMEFRAME_MINUTES[timeframe];
  const ratio = targetMinutes / sourceMinutes;
  data = Number.isInteger(ratio) && ratio >= 1 ? aggregateOhlc(baseData, ratio) : [...baseData];
  series.setData(data);
  fitChart();
}

function fitChart(): void {
  chart.timeScale().fitContent();
  chart.timeScale().setOptions({ rightOffset: RIGHT_MARGIN_BARS });
  updateSummary();
}

function aggregateOhlc(source: readonly OhlcData[], minutes: number): OhlcData[] {
  if (minutes <= 1) {
    return [...source];
  }

  const bucketMs = minutes * 60_000;
  const result: OhlcData[] = [];

  for (const bar of source) {
    const bucketTime = Math.floor(bar.time / bucketMs) * bucketMs;
    const current = result[result.length - 1];

    if (!current || current.time !== bucketTime) {
      result.push({
        time: bucketTime,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume ?? 0,
      });
      continue;
    }

    current.high = Math.max(current.high, bar.high);
    current.low = Math.min(current.low, bar.low);
    current.close = bar.close;
    current.volume = (current.volume ?? 0) + (bar.volume ?? 0);
  }

  return result;
}

function loadSessions(): void {
  if (feedActive) {
    stopFeed();
  }
  binanceLabel = "US equities RTH";
  instrumentLabel = "SPX";
  summaryTimezone = "America/New_York";
  sourceMinutes = 1;
  series.setOptions({ title: "SPX" });
  binanceButton.classList.remove("active");
  spxButton.classList.remove("active");
  timeframe = "1m";
  timeframeSelect.value = "1m";
  timeframeSelect.disabled = false;
  chart.timeScale().setOptions({
    calendar: US_EQUITIES_RTH,
    gapMode: "show",
    gapWidth: 24,
    maxVisibleBars: SESSION_VISIBLE_BARS,
  });
  baseData = generateSessionOhlc(2, 390, seed);
  applyTimeframe();
  feedStatus.textContent = `${data.length.toLocaleString("en-US")} 1m bars`;
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
    chart.timeScale().setOptions({
      calendar: null,
      gapMode: "compress",
      maxVisibleBars: MAX_VISIBLE_BARS,
    });
    baseData = parseSnapshot(snapshot);
    sourceMinutes = 1;
    timeframeSelect.disabled = false;
    instrumentLabel = "BTC/USDT";
    summaryTimezone = "UTC";
    series.setOptions({ title: "BTC/USD" });
    binanceLabel = `Binance ${snapshot.market} ${snapshot.symbol} ${snapshot.year}`;
    binanceButton.classList.add("active");
    spxButton.classList.remove("active");
    applyTimeframe();
    feedStatus.textContent = `${data.length.toLocaleString("en-US")} ${timeframe} bars`;
  } catch (error) {
    console.error("Could not load the local Binance snapshot", error);
    feedStatus.textContent = "Binance snapshot missing — run data:binance";
  } finally {
    binanceButton.disabled = false;
  }
}

async function loadSpx(): Promise<void> {
  if (feedActive) {
    stopFeed();
    feedButton.textContent = "Use feed";
  }

  spxButton.disabled = true;
  feedStatus.textContent = "loading SPX…";

  try {
    const response = await fetch("/data/yahoo-gspc-5m-1mo.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const snapshot = (await response.json()) as YahooSnapshot;
    baseData = parseSnapshot(snapshot);
    sourceMinutes = 5;
    timeframe = "5m";
    timeframeSelect.value = "5m";
    timeframeSelect.disabled = true;
    instrumentLabel = "SPX";
    summaryTimezone = snapshot.timezone || "America/New_York";
    binanceLabel = `Yahoo ${snapshot.symbol} ${snapshot.range}`;
    series.setOptions({ title: "SPX" });
    binanceButton.classList.remove("active");
    spxButton.classList.add("active");
    chart.timeScale().setOptions({
      calendar: US_EQUITIES_RTH,
      gapMode: "show",
      gapWidth: 8,
      maxVisibleBars: SPX_VISIBLE_BARS,
    });
    applyTimeframe();
    feedStatus.textContent = `${data.length.toLocaleString("en-US")} 5m bars`;
  } catch (error) {
    console.error("Could not load the local SPX snapshot", error);
    feedStatus.textContent = "SPX snapshot missing — run data:yahoo";
  } finally {
    spxButton.disabled = false;
  }
}

function parseSnapshot(snapshot: SnapshotBars): OhlcData[] {
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
  if (zoomBench) {
    chart.timeScale().setOptions({ maxVisibleBars: count });
  }
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
    fitChart();
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

timeframeSelect.addEventListener("change", () => {
  if (feedActive) {
    return;
  }
  timeframe = timeframeSelect.value as Timeframe;
  applyTimeframe();
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
    fitChart();
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

spxButton.addEventListener("click", () => {
  void loadSpx();
});

seriesDemoButton.addEventListener("click", () => {
  window.location.href = "/series.html";
});

fitButton.addEventListener("click", () => {
  fitChart();
});

resetButton.addEventListener("click", () => {
  chart.resetView();
  chart.timeScale().setOptions({ rightOffset: RIGHT_MARGIN_BARS });
  updateSummary();
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

  const theme = dark ? DarkTheme : LightTheme;
  chart.setOptions({
    ...theme,
    crosshair: {
      ...theme.crosshair,
      mode: "magnet",
    },
  });
  document.body.dataset.theme = dark ? "dark" : "light";
  themeButton.textContent = dark ? "Light" : "Dark";
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

const requestedTimeframe = params.get("timeframe");
if (requestedTimeframe && isTimeframe(requestedTimeframe)) {
  timeframe = requestedTimeframe;
  timeframeSelect.value = requestedTimeframe;
}

document.body.dataset.theme = "dark";
if (params.has("sessions")) {
  loadSessions();
} else {
  load();
}

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

if (params.has("spx")) {
  void loadSpx();
}

if (testMode) {
  markReady();
}

if (benchMode) {
  void runBenchmark();
}

function isTimeframe(value: string): value is Timeframe {
  return value in TIMEFRAME_MINUTES;
}
