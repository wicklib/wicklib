import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatafeedController, type DatafeedControllerHost } from "../src/data/datafeed-controller";
import { OhlcStore } from "../src/data/ohlc-store";
import type { WickError } from "../src/errors";
import type { DataRequest, DataResponse, Datafeed, OhlcData, VisibleRange } from "../src/types";

const BASE = 1_000_000;
const MINUTE = 60_000;

function bar(time: number, overrides: Partial<OhlcData> = {}): OhlcData {
  return {
    time,
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    ...overrides,
  };
}

interface PendingRequest {
  request: DataRequest;
  signal: AbortSignal;
  resolve: (response: DataResponse<OhlcData>) => void;
  reject: (error: unknown) => void;
}

function createFeed() {
  const pending: PendingRequest[] = [];
  const listeners: Array<(data: OhlcData) => void> = [];
  const errorListeners: Array<(error: unknown) => void> = [];
  let unsubscribed = 0;

  const feed: Datafeed<OhlcData> = {
    getData(request, { signal }) {
      return new Promise((resolve, reject) => {
        pending.push({ request, signal, resolve, reject });
        signal.addEventListener("abort", () => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    },
    subscribe(_request, listener, onError) {
      listeners.push(listener);
      errorListeners.push(onError);
      return () => {
        unsubscribed += 1;
      };
    },
  };

  return {
    feed,
    pending,
    listeners,
    errorListeners,
    get unsubscribed(): number {
      return unsubscribed;
    },
  };
}

function createHost(store: OhlcStore) {
  let view: VisibleRange = { from: 0, to: 0 };
  let restored: VisibleRange | null = null;
  let fitted = 0;
  let changed = 0;
  let atRight = true;
  const loading: boolean[] = [];
  const errors: WickError[] = [];

  const host: DatafeedControllerHost<OhlcData> = {
    getVisibleRange: () => view,
    restoreVisibleRange: (range) => {
      view = range;
      restored = range;
    },
    isAtRightEdge: () => atRight,
    fitContentIfDefault: () => {
      fitted += 1;
    },
    getDataBounds: () => {
      const first = store.firstTime();
      const last = store.lastTime();
      return first === null || last === null ? null : { first, last };
    },
    mergeData: (data) => {
      store.merge(data);
    },
    updateData: (data) => {
      store.update(data);
    },
    onSeriesDataChanged: () => {
      changed += 1;
    },
    emitLoading: (value) => {
      loading.push(value);
    },
    emitError: (error) => {
      errors.push(error);
    },
  };

  return {
    host,
    setView: (range: VisibleRange) => {
      view = range;
    },
    getView: () => view,
    setAtRight: (value: boolean) => {
      atRight = value;
    },
    get restored(): VisibleRange | null {
      return restored;
    },
    get fitted(): number {
      return fitted;
    },
    get changed(): number {
      return changed;
    },
    loading,
    errors,
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("DatafeedController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads the initial count and reports loading", async () => {
    const store = new OhlcStore();
    const host = createHost(store);
    const feed = createFeed();
    const controller = new DatafeedController(host.host, feed.feed, {
      symbol: "BTC",
      interval: "1m",
      initialBars: 3,
    });

    controller.start();

    expect(controller.isLoading()).toBe(true);
    expect(host.loading).toEqual([true]);
    expect(feed.pending).toHaveLength(1);
    expect(feed.pending[0]?.request).toEqual({ symbol: "BTC", interval: "1m", count: 3 });

    feed.pending.shift()!.resolve({
      data: [bar(BASE), bar(BASE + MINUTE), bar(BASE + 2 * MINUTE)],
    });
    await flush();

    expect(store.length).toBe(3);
    expect(controller.isLoading()).toBe(false);
    expect(host.loading).toEqual([true, false]);
    expect(host.fitted).toBe(1);
    expect(host.changed).toBe(1);
    expect(feed.listeners).toHaveLength(1);

    controller.stop();
  });

  it("loads missing history and anchors the current view", async () => {
    const store = new OhlcStore();
    const host = createHost(store);
    const feed = createFeed();
    const controller = new DatafeedController(host.host, feed.feed, {
      symbol: "BTC",
      interval: "1m",
      initialBars: 3,
    });

    controller.start();
    feed.pending.shift()!.resolve({
      data: [bar(BASE), bar(BASE + MINUTE), bar(BASE + 2 * MINUTE)],
    });
    await flush();

    host.setView({ from: BASE, to: BASE + 2 * MINUTE });
    controller.onViewChange();
    await vi.advanceTimersByTimeAsync(120);

    expect(feed.pending).toHaveLength(1);
    expect(feed.pending[0]?.request).toEqual({
      symbol: "BTC",
      interval: "1m",
      from: BASE - MINUTE,
      to: BASE - 1,
    });

    host.setView({ from: BASE + MINUTE, to: BASE + 3 * MINUTE });
    feed.pending.shift()!.resolve({
      data: [bar(BASE - 2 * MINUTE), bar(BASE - MINUTE)],
    });
    await flush();

    expect(store.length).toBe(5);
    expect(host.restored).toEqual({ from: BASE + MINUTE, to: BASE + 3 * MINUTE });

    controller.stop();
  });

  it("stops requesting a direction after noDataBefore", async () => {
    const store = new OhlcStore();
    const host = createHost(store);
    const feed = createFeed();
    const controller = new DatafeedController(host.host, feed.feed, {
      symbol: "BTC",
      interval: "1m",
      initialBars: 3,
    });

    controller.start();
    feed.pending.shift()!.resolve({
      data: [bar(BASE), bar(BASE + MINUTE), bar(BASE + 2 * MINUTE)],
      noDataBefore: true,
    });
    await flush();

    host.setView({ from: BASE, to: BASE + 2 * MINUTE });
    controller.onViewChange();
    await vi.advanceTimersByTimeAsync(120);

    expect(feed.pending[0]?.request).toEqual({
      symbol: "BTC",
      interval: "1m",
      from: BASE + 2 * MINUTE + 1,
      to: BASE + 3 * MINUTE,
    });

    controller.stop();
  });

  it("aborts in-flight requests on stop", async () => {
    const store = new OhlcStore();
    const host = createHost(store);
    const feed = createFeed();
    const controller = new DatafeedController(host.host, feed.feed, {
      symbol: "BTC",
      interval: "1m",
    });

    controller.start();
    const pending = feed.pending[0]!;
    controller.stop();

    expect(pending.signal.aborted).toBe(true);
    await flush();
    expect(controller.isLoading()).toBe(false);
    expect(host.errors).toHaveLength(0);
    expect(host.loading).toEqual([true, false]);
  });

  it("replaces, appends, and ignores older realtime data", async () => {
    const store = new OhlcStore();
    const host = createHost(store);
    const feed = createFeed();
    const controller = new DatafeedController(host.host, feed.feed, {
      symbol: "BTC",
      interval: "1m",
      initialBars: 3,
    });

    controller.start();
    feed.pending.shift()!.resolve({
      data: [bar(BASE), bar(BASE + MINUTE), bar(BASE + 2 * MINUTE)],
    });
    await flush();

    const listener = feed.listeners[0]!;

    listener(bar(BASE + 2 * MINUTE, { close: 200, high: 205 }));
    expect(store.closeAt(2)).toBe(200);

    listener(bar(BASE + 3 * MINUTE));
    expect(store.length).toBe(4);

    listener(bar(BASE));
    expect(store.length).toBe(4);

    host.setAtRight(false);
    const anchoredView = { from: BASE, to: BASE + 3 * MINUTE };
    host.setView(anchoredView);
    listener(bar(BASE + 4 * MINUTE));
    expect(store.length).toBe(5);
    expect(host.restored).toEqual(anchoredView);

    controller.stop();
    expect(feed.unsubscribed).toBe(1);
  });

  it("reports datafeed errors and clears loading", async () => {
    const store = new OhlcStore();
    const host = createHost(store);
    const feed = createFeed();
    const controller = new DatafeedController(host.host, feed.feed, {
      symbol: "BTC",
      interval: "1m",
    });

    controller.start();
    feed.pending.shift()!.reject(new Error("boom"));
    await flush();

    expect(host.errors).toHaveLength(1);
    expect(host.errors[0]?.code).toBe("DATAFEED_ERROR");
    expect(controller.isLoading()).toBe(false);
    expect(host.loading).toEqual([true, false]);

    controller.stop();
  });
});
