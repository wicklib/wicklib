import type {
  IndicatorBars,
  IndicatorDefinition,
  IndicatorOutput,
  SourceValue,
} from "@wicklib/core";

import { VERSION } from "./version";

const SOURCE_VALUES: readonly SourceValue[] = [
  "open",
  "high",
  "low",
  "close",
  "hl2",
  "hlc3",
  "ohlc4",
];

const DAY_MS = 24 * 60 * 60 * 1000;

type SourceInputs = {
  source: SourceValue;
};

type PeriodSourceInputs = SourceInputs & {
  period: number;
};

type SmaInputs = PeriodSourceInputs;
type EmaInputs = PeriodSourceInputs;
type RsiInputs = PeriodSourceInputs;
type VwapInputs = SourceInputs;
type AtrInputs = {
  period: number;
};
type BollingerInputs = PeriodSourceInputs & {
  multiplier: number;
};
type MacdInputs = SourceInputs & {
  fast: number;
  slow: number;
  signal: number;
};

const sourceInput = (defaultValue: SourceValue = "close") => ({
  id: "source",
  name: "Source",
  type: "source" as const,
  defaultValue,
  options: SOURCE_VALUES,
});

const periodInput = (defaultValue: number) => ({
  id: "period",
  name: "Period",
  type: "number" as const,
  defaultValue,
  min: 1,
  max: 1000,
  step: 1,
});

export const SMA: IndicatorDefinition<SmaInputs> = {
  meta: {
    id: "com.wicklib.sma",
    name: "SMA",
    version: VERSION,
    license: "free",
  },
  inputs: [periodInput(20), sourceInput()],
  plots: [{ id: "sma", title: "SMA", type: "line", color: "#2962ff" }],
  defaultPane: "main",
  compute({ bars, inputs }) {
    return { sma: sma(sourceValues(bars, inputs.source), inputs.period) };
  },
};

export const EMA: IndicatorDefinition<EmaInputs> = {
  meta: {
    id: "com.wicklib.ema",
    name: "EMA",
    version: VERSION,
    license: "free",
  },
  inputs: [periodInput(20), sourceInput()],
  plots: [{ id: "ema", title: "EMA", type: "line", color: "#ff9800" }],
  defaultPane: "main",
  compute({ bars, inputs }) {
    return { ema: ema(sourceValues(bars, inputs.source), inputs.period) };
  },
};

export const RSI: IndicatorDefinition<RsiInputs> = {
  meta: {
    id: "com.wicklib.rsi",
    name: "RSI",
    version: VERSION,
    license: "free",
  },
  inputs: [periodInput(14), sourceInput()],
  plots: [{ id: "rsi", title: "RSI", type: "line", color: "#7e57c2" }],
  defaultPane: "separate",
  compute({ bars, inputs }) {
    return { rsi: rsi(sourceValues(bars, inputs.source), inputs.period) };
  },
};

export const MACD: IndicatorDefinition<MacdInputs> = {
  meta: {
    id: "com.wicklib.macd",
    name: "MACD",
    version: VERSION,
    license: "free",
  },
  inputs: [
    {
      id: "fast",
      name: "Fast",
      type: "number",
      defaultValue: 12,
      min: 1,
      max: 200,
      step: 1,
    },
    {
      id: "slow",
      name: "Slow",
      type: "number",
      defaultValue: 26,
      min: 1,
      max: 400,
      step: 1,
    },
    {
      id: "signal",
      name: "Signal",
      type: "number",
      defaultValue: 9,
      min: 1,
      max: 100,
      step: 1,
    },
    sourceInput(),
  ],
  plots: [
    { id: "macd", title: "MACD", type: "line", color: "#2962ff" },
    { id: "signal", title: "Signal", type: "line", color: "#ff9800" },
    {
      id: "histogram",
      title: "Histogram",
      type: "histogram",
      color: "#26a69a",
      baseline: 0,
    },
  ],
  defaultPane: "separate",
  compute({ bars, inputs }) {
    return macd(sourceValues(bars, inputs.source), inputs.fast, inputs.slow, inputs.signal);
  },
};

export const BollingerBands: IndicatorDefinition<BollingerInputs> = {
  meta: {
    id: "com.wicklib.bollinger-bands",
    name: "Bollinger Bands",
    version: VERSION,
    license: "free",
  },
  inputs: [
    periodInput(20),
    {
      id: "multiplier",
      name: "Multiplier",
      type: "number",
      defaultValue: 2,
      min: 0.1,
      max: 10,
      step: 0.1,
    },
    sourceInput(),
  ],
  plots: [
    { id: "upper", title: "Upper", type: "line", color: "#ef5350" },
    { id: "middle", title: "Middle", type: "line", color: "#9598a1" },
    { id: "lower", title: "Lower", type: "line", color: "#26a69a" },
  ],
  defaultPane: "main",
  compute({ bars, inputs }) {
    return bollinger(sourceValues(bars, inputs.source), inputs.period, inputs.multiplier);
  },
};

export const VWAP: IndicatorDefinition<VwapInputs> = {
  meta: {
    id: "com.wicklib.vwap",
    name: "VWAP",
    version: VERSION,
    license: "free",
  },
  inputs: [sourceInput("hlc3")],
  plots: [{ id: "vwap", title: "VWAP", type: "line", color: "#26a69a" }],
  defaultPane: "main",
  compute({ bars, inputs }) {
    return { vwap: vwap(bars, inputs.source) };
  },
};

export const ATR: IndicatorDefinition<AtrInputs> = {
  meta: {
    id: "com.wicklib.atr",
    name: "ATR",
    version: VERSION,
    license: "free",
  },
  inputs: [periodInput(14)],
  plots: [{ id: "atr", title: "ATR", type: "line", color: "#ef5350" }],
  defaultPane: "separate",
  compute({ bars, inputs }) {
    return { atr: atr(bars, inputs.period) };
  },
};

function sourceValues(bars: IndicatorBars, source: SourceValue): number[] {
  const values = new Array<number>(bars.length);

  for (let index = 0; index < bars.length; index += 1) {
    const high = bars.highAt(index);
    const low = bars.lowAt(index);
    const open = bars.openAt(index);
    const close = bars.closeAt(index);

    switch (source) {
      case "open":
        values[index] = open;
        break;
      case "high":
        values[index] = high;
        break;
      case "low":
        values[index] = low;
        break;
      case "hl2":
        values[index] = (high + low) / 2;
        break;
      case "hlc3":
        values[index] = (high + low + close) / 3;
        break;
      case "ohlc4":
        values[index] = (open + high + low + close) / 4;
        break;
      default:
        values[index] = close;
    }
  }

  return values;
}

function sma(values: readonly number[], period: number): Array<number | null> {
  const result = new Array<number | null>(values.length).fill(null);
  if (period <= 0 || values.length < period) {
    return result;
  }

  let sum = 0;
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index]!;
    if (index >= period) {
      sum -= values[index - period]!;
    }
    if (index >= period - 1) {
      result[index] = sum / period;
    }
  }

  return result;
}

function ema(values: readonly number[], period: number): Array<number | null> {
  const result = new Array<number | null>(values.length).fill(null);
  if (period <= 0 || values.length < period) {
    return result;
  }

  let sum = 0;
  for (let index = 0; index < period; index += 1) {
    sum += values[index]!;
  }

  let previous = sum / period;
  result[period - 1] = previous;
  const alpha = 2 / (period + 1);

  for (let index = period; index < values.length; index += 1) {
    previous = values[index]! * alpha + previous * (1 - alpha);
    result[index] = previous;
  }

  return result;
}

function emaNullable(values: ReadonlyArray<number | null>, period: number): Array<number | null> {
  const result = new Array<number | null>(values.length).fill(null);
  if (period <= 0) {
    return result;
  }

  let start = -1;
  for (let index = period - 1; index < values.length; index += 1) {
    let ready = true;
    for (let offset = index - period + 1; offset <= index; offset += 1) {
      if (values[offset] === null) {
        ready = false;
        break;
      }
    }
    if (ready) {
      start = index;
      break;
    }
  }

  if (start < 0) {
    return result;
  }

  let sum = 0;
  for (let index = start - period + 1; index <= start; index += 1) {
    sum += values[index]!;
  }

  let previous = sum / period;
  result[start] = previous;
  const alpha = 2 / (period + 1);

  for (let index = start + 1; index < values.length; index += 1) {
    const value = values[index];
    if (value === null || value === undefined) {
      result[index] = null;
      continue;
    }
    previous = value * alpha + previous * (1 - alpha);
    result[index] = previous;
  }

  return result;
}

function rsi(values: readonly number[], period: number): Array<number | null> {
  const result = new Array<number | null>(values.length).fill(null);
  if (period <= 0 || values.length <= period) {
    return result;
  }

  let gain = 0;
  let loss = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = values[index]! - values[index - 1]!;
    if (change >= 0) {
      gain += change;
    } else {
      loss -= change;
    }
  }

  let averageGain = gain / period;
  let averageLoss = loss / period;
  result[period] = rsiValue(averageGain, averageLoss);

  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index]! - values[index - 1]!;
    const nextGain = Math.max(change, 0);
    const nextLoss = Math.max(-change, 0);
    averageGain = (averageGain * (period - 1) + nextGain) / period;
    averageLoss = (averageLoss * (period - 1) + nextLoss) / period;
    result[index] = rsiValue(averageGain, averageLoss);
  }

  return result;
}

function rsiValue(averageGain: number, averageLoss: number): number {
  if (averageLoss === 0) {
    return averageGain === 0 ? 50 : 100;
  }
  return 100 - 100 / (1 + averageGain / averageLoss);
}

function trueRange(bars: IndicatorBars): number[] {
  const result = new Array<number>(bars.length);

  for (let index = 0; index < bars.length; index += 1) {
    const high = bars.highAt(index);
    const low = bars.lowAt(index);
    if (index === 0) {
      result[index] = high - low;
      continue;
    }
    const previousClose = bars.closeAt(index - 1);
    result[index] = Math.max(
      high - low,
      Math.abs(high - previousClose),
      Math.abs(low - previousClose),
    );
  }

  return result;
}

function atr(bars: IndicatorBars, period: number): Array<number | null> {
  const result = new Array<number | null>(bars.length).fill(null);
  if (period <= 0 || bars.length < period) {
    return result;
  }

  const ranges = trueRange(bars);
  let sum = 0;
  for (let index = 0; index < period; index += 1) {
    sum += ranges[index]!;
  }

  let previous = sum / period;
  result[period - 1] = previous;

  for (let index = period; index < ranges.length; index += 1) {
    previous = (previous * (period - 1) + ranges[index]!) / period;
    result[index] = previous;
  }

  return result;
}

function bollinger(values: readonly number[], period: number, multiplier: number): IndicatorOutput {
  const middle = sma(values, period);
  const upper = new Array<number | null>(values.length).fill(null);
  const lower = new Array<number | null>(values.length).fill(null);

  for (let index = period - 1; index < values.length; index += 1) {
    const mean = middle[index];
    if (mean === null || mean === undefined) {
      continue;
    }

    let variance = 0;
    for (let offset = index - period + 1; offset <= index; offset += 1) {
      const delta = values[offset]! - mean;
      variance += delta * delta;
    }

    const deviation = Math.sqrt(variance / period);
    upper[index] = mean + multiplier * deviation;
    lower[index] = mean - multiplier * deviation;
  }

  return { upper, middle, lower };
}

function macd(
  values: readonly number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): IndicatorOutput {
  const fast = ema(values, fastPeriod);
  const slow = ema(values, slowPeriod);
  const line = new Array<number | null>(values.length).fill(null);

  for (let index = 0; index < values.length; index += 1) {
    const fastValue = fast[index];
    const slowValue = slow[index];
    if (
      fastValue !== null &&
      fastValue !== undefined &&
      slowValue !== null &&
      slowValue !== undefined
    ) {
      line[index] = fastValue - slowValue;
    }
  }

  const signal = emaNullable(line, signalPeriod);
  const histogram = new Array<number | null>(values.length).fill(null);

  for (let index = 0; index < values.length; index += 1) {
    const lineValue = line[index];
    const signalValue = signal[index];
    if (
      lineValue !== null &&
      lineValue !== undefined &&
      signalValue !== null &&
      signalValue !== undefined
    ) {
      histogram[index] = lineValue - signalValue;
    }
  }

  return { macd: line, signal, histogram };
}

function vwap(bars: IndicatorBars, source: SourceValue): Array<number | null> {
  const result = new Array<number | null>(bars.length).fill(null);
  const values = sourceValues(bars, source);
  let currentDay = Number.NaN;
  let cumulativePV = 0;
  let cumulativeVolume = 0;

  for (let index = 0; index < bars.length; index += 1) {
    const day = Math.floor(bars.timeAt(index) / DAY_MS);
    if (day !== currentDay) {
      currentDay = day;
      cumulativePV = 0;
      cumulativeVolume = 0;
    }

    const volume = bars.volumeAt(index);
    if (volume === undefined || volume <= 0) {
      continue;
    }

    cumulativePV += values[index]! * volume;
    cumulativeVolume += volume;
    result[index] = cumulativePV / cumulativeVolume;
  }

  return result;
}
