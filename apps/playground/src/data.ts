import type { OhlcData, TradingCalendar } from "@wicklib/core";

const MINUTE = 60_000;
const DAY = 86_400_000;
const START = Date.UTC(2024, 0, 1);
const SESSION_START = Date.UTC(2025, 6, 7, 13, 30);

export const US_EQUITIES_RTH: TradingCalendar = {
  timezone: "America/New_York",
  sessions: [1, 2, 3, 4, 5].map((day) => ({
    openDay: day,
    openTime: "09:30",
    closeDay: day,
    closeTime: "16:00",
  })),
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function generateOhlc(count: number, seed = 1): OhlcData[] {
  const random = mulberry32(seed);
  const bars: OhlcData[] = new Array(count);
  let price = 100;

  for (let index = 0; index < count; index += 1) {
    const open = price;
    const change = (100 - open) * 0.002 + (random() - 0.5) * 0.9;
    const close = Math.max(1, open + change);
    const wick = random() * 0.7 + 0.02;
    const high = Math.max(open, close) + wick;
    const low = Math.max(0.5, Math.min(open, close) - wick);

    bars[index] = {
      time: START + index * MINUTE,
      open,
      high,
      low,
      close,
      volume: 100 + Math.abs(close - open) * 1000,
    };
    price = close;
  }

  return bars;
}

export function generateSessionOhlc(sessions = 2, barsPerSession = 390, seed = 7): OhlcData[] {
  const random = mulberry32(seed);
  const bars: OhlcData[] = [];
  let price = 100;
  let day = SESSION_START;
  let generated = 0;

  while (generated < sessions) {
    const weekday = new Date(day).getUTCDay();
    if (weekday === 0 || weekday === 6) {
      day += DAY;
      continue;
    }

    for (let index = 0; index < barsPerSession; index += 1) {
      const open = price;
      const change = (100 - open) * 0.002 + (random() - 0.5) * 0.9;
      const close = Math.max(1, open + change);
      const wick = random() * 0.7 + 0.02;
      const high = Math.max(open, close) + wick;
      const low = Math.max(0.5, Math.min(open, close) - wick);

      bars.push({
        time: day + index * MINUTE,
        open,
        high,
        low,
        close,
        volume: 100 + Math.abs(close - open) * 1000,
      });
      price = close;
    }

    generated += 1;
    day += DAY;
  }

  return bars;
}
