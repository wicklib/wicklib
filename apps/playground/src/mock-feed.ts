import type { Datafeed, OhlcData } from "@wicklib/core";

const LATENCY_MIN = 120;
const LATENCY_MAX = 280;

/**
 * Simulated async feed over the playground dataset.
 *
 * Initial loads return the latest `count` bars. Range loads slice the shared dataset.
 * The realtime subscription appends one bar every 500 ms.
 */
export function createMockFeed(getBars: () => OhlcData[]): Datafeed<OhlcData> {
  return {
    async getData(request, { signal }) {
      await delay(LATENCY_MIN + Math.random() * (LATENCY_MAX - LATENCY_MIN), signal);

      const bars = getBars();
      if (bars.length === 0) {
        return { data: [] };
      }

      if (request.count !== undefined) {
        return { data: bars.slice(-request.count) };
      }

      const from = request.from ?? bars[0]!.time;
      const to = request.to ?? bars[bars.length - 1]!.time;
      const start = lowerBound(bars, from);
      const end = upperBound(bars, to);

      return {
        data: bars.slice(start, end),
        noDataBefore: start === 0,
        noDataAfter: end === bars.length,
      };
    },

    subscribe(_request, listener) {
      const timer = setInterval(() => {
        const bars = getBars();
        const last = bars[bars.length - 1];
        if (!last) {
          return;
        }

        const open = last.close;
        const close = Math.max(1, open + (Math.random() - 0.5) * 0.9);
        const high = Math.max(open, close) + Math.random() * 0.5;
        const low = Math.max(0.5, Math.min(open, close) - Math.random() * 0.5);
        const next: OhlcData = {
          time: last.time + 60_000,
          open,
          high,
          low,
          close,
        };

        bars.push(next);
        listener(next);
      }, 500);

      return () => {
        clearInterval(timer);
      };
    },
  };
}

function lowerBound(bars: readonly OhlcData[], time: number): number {
  let low = 0;
  let high = bars.length;

  while (low < high) {
    const mid = (low + high) >> 1;
    if (bars[mid]!.time < time) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function upperBound(bars: readonly OhlcData[], time: number): number {
  let low = 0;
  let high = bars.length;

  while (low < high) {
    const mid = (low + high) >> 1;
    if (bars[mid]!.time <= time) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);

    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        const error = new Error("Aborted");
        error.name = "AbortError";
        reject(error);
      },
      { once: true },
    );
  });
}
