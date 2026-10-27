import { fail, WickError } from "../errors";
import type {
  Datafeed,
  DataRequest,
  DataResponse,
  SeriesData,
  SeriesDatafeedOptions,
  Time,
  Unsubscribe,
  VisibleRange,
} from "../types";

const DEBOUNCE_MS = 120;
const DEFAULT_INITIAL_BARS = 500;
const MAX_INITIAL_BARS = 10_000;
const MAX_CONSECUTIVE_RANGE_REQUESTS = 4;

export interface DatafeedControllerHost<TData extends SeriesData> {
  getVisibleRange(): VisibleRange;
  restoreVisibleRange(range: VisibleRange): void;
  isAtRightEdge(): boolean;
  fitContentIfDefault(): void;
  getDataBounds(): { first: Time; last: Time } | null;
  mergeData(data: readonly TData[]): void;
  updateData(data: TData): void;
  onSeriesDataChanged(): void;
  emitLoading(loading: boolean): void;
  emitError(error: WickError): void;
}

interface PlannedRequest {
  side: "left" | "right";
  request: DataRequest;
}

/**
 * Owns the lifecycle of a series datafeed: initial load, range loads, realtime
 * subscription, debounce, abort, and loading/error reporting.
 */
export class DatafeedController<TData extends SeriesData> {
  private readonly host: DatafeedControllerHost<TData>;
  private readonly feed: Datafeed<TData>;
  private readonly symbol: string;
  private readonly interval: string;
  private readonly initialBars: number;

  private stopped = false;
  private loading = false;
  private initialLoaded = false;
  private noDataBefore = false;
  private noDataAfter = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private requestId = 0;
  private currentRequest: { id: number; controller: AbortController } | null = null;
  private unsubscribe: Unsubscribe | null = null;
  private consecutiveRangeRequests = 0;

  constructor(
    host: DatafeedControllerHost<TData>,
    feed: Datafeed<TData>,
    options: SeriesDatafeedOptions,
  ) {
    if (typeof options.symbol !== "string" || options.symbol.length === 0) {
      fail("INVALID_ARGUMENT", "datafeed symbol must be a non-empty string");
    }
    if (typeof options.interval !== "string" || options.interval.length === 0) {
      fail("INVALID_ARGUMENT", "datafeed interval must be a non-empty string");
    }

    const requested = options.initialBars ?? DEFAULT_INITIAL_BARS;
    if (!Number.isFinite(requested) || requested <= 0) {
      fail("INVALID_ARGUMENT", "initialBars must be a positive number");
    }

    this.host = host;
    this.feed = feed;
    this.symbol = options.symbol;
    this.interval = options.interval;
    this.initialBars = Math.min(MAX_INITIAL_BARS, Math.floor(requested));
  }

  start(): void {
    if (this.stopped) {
      return;
    }
    this.setLoading(true);
    void this.loadInitial();
  }

  stop(): void {
    if (this.stopped) {
      return;
    }

    this.stopped = true;

    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.currentRequest) {
      this.currentRequest.controller.abort();
      this.currentRequest = null;
    }

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.setLoading(false);
  }

  isLoading(): boolean {
    return this.loading;
  }

  onViewChange(): void {
    if (this.stopped || !this.initialLoaded) {
      return;
    }

    this.consecutiveRangeRequests = 0;
    this.scheduleRangeLoad();
  }

  private async loadInitial(): Promise<void> {
    const { id, signal } = this.beginRequest();
    this.setLoading(true);

    try {
      const response = await this.feed.getData(
        { symbol: this.symbol, interval: this.interval, count: this.initialBars },
        { signal },
      );

      if (!this.isCurrent(id)) {
        return;
      }

      this.applyResponse(response);
      this.initialLoaded = true;
      this.host.onSeriesDataChanged();
      this.host.fitContentIfDefault();
      this.startSubscription();
      this.setLoading(false);
      this.scheduleRangeLoad();
    } catch (error) {
      if (!this.isCurrent(id)) {
        return;
      }
      this.reportError(error);
      this.setLoading(false);
    } finally {
      this.endRequest(id);
    }
  }

  private async loadRange(): Promise<void> {
    if (this.stopped || !this.initialLoaded) {
      return;
    }

    if (this.consecutiveRangeRequests >= MAX_CONSECUTIVE_RANGE_REQUESTS) {
      return;
    }

    const planned = this.planRangeRequest();
    if (!planned) {
      return;
    }

    this.consecutiveRangeRequests += 1;
    const { id, signal } = this.beginRequest();
    this.setLoading(true);

    try {
      const response = await this.feed.getData(planned.request, { signal });

      if (!this.isCurrent(id)) {
        return;
      }

      const anchor = this.host.getVisibleRange();
      this.applyResponse(response);

      if (response.data.length === 0) {
        if (planned.side === "left") {
          this.noDataBefore = true;
        } else {
          this.noDataAfter = true;
        }
      }

      this.host.restoreVisibleRange(anchor);
      this.host.onSeriesDataChanged();
      this.setLoading(false);
      this.scheduleRangeLoad();
    } catch (error) {
      if (!this.isCurrent(id)) {
        return;
      }
      this.reportError(error);
      this.setLoading(false);
    } finally {
      this.endRequest(id);
    }
  }

  private planRangeRequest(): PlannedRequest | null {
    const bounds = this.host.getDataBounds();
    if (!bounds) {
      return null;
    }

    const visible = this.host.getVisibleRange();
    const span = Math.max(1, visible.to - visible.from);
    const prefetch = span * 0.5;
    const leftTarget = Math.floor(visible.from - prefetch);
    const rightTarget = Math.ceil(visible.to + prefetch);

    const leftGap = bounds.first - leftTarget;
    const rightGap = rightTarget - bounds.last;
    const canLoadLeft = !this.noDataBefore && leftGap > 0;
    const canLoadRight = !this.noDataAfter && rightGap > 0;

    if (!canLoadLeft && !canLoadRight) {
      return null;
    }

    if (canLoadLeft && (!canLoadRight || leftGap >= rightGap)) {
      const to = bounds.first - 1;
      if (leftTarget < to) {
        return {
          side: "left",
          request: {
            symbol: this.symbol,
            interval: this.interval,
            from: leftTarget,
            to,
          },
        };
      }
    }

    if (canLoadRight) {
      const from = bounds.last + 1;
      if (from < rightTarget) {
        return {
          side: "right",
          request: {
            symbol: this.symbol,
            interval: this.interval,
            from,
            to: rightTarget,
          },
        };
      }
    }

    return null;
  }

  private applyResponse(response: DataResponse<TData>): void {
    this.host.mergeData(response.data);

    if (response.noDataBefore) {
      this.noDataBefore = true;
    }
    if (response.noDataAfter) {
      this.noDataAfter = true;
    }
  }

  private startSubscription(): void {
    if (!this.feed.subscribe || this.unsubscribe) {
      return;
    }

    try {
      this.unsubscribe = this.feed.subscribe(
        { symbol: this.symbol, interval: this.interval },
        (data) => {
          this.handleRealtime(data);
        },
        (error) => {
          this.reportError(error);
        },
      );
    } catch (error) {
      this.reportError(error);
    }
  }

  private handleRealtime(data: TData): void {
    if (this.stopped) {
      return;
    }

    const bounds = this.host.getDataBounds();
    if (!bounds) {
      return;
    }

    if (data.time < bounds.last) {
      return;
    }

    const atRightEdge = this.host.isAtRightEdge();
    const before = this.host.getVisibleRange();

    try {
      this.host.updateData(data);
    } catch (error) {
      this.reportError(error);
      return;
    }

    if (!atRightEdge) {
      this.host.restoreVisibleRange(before);
    }

    this.host.onSeriesDataChanged();
  }

  private scheduleRangeLoad(): void {
    if (this.stopped || !this.initialLoaded || this.timer !== null) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.loadRange();
    }, DEBOUNCE_MS);
  }

  private beginRequest(): { id: number; signal: AbortSignal } {
    if (this.currentRequest) {
      this.currentRequest.controller.abort();
    }

    this.requestId += 1;
    const controller = new AbortController();
    this.currentRequest = { id: this.requestId, controller };

    return { id: this.requestId, signal: controller.signal };
  }

  private isCurrent(id: number): boolean {
    return !this.stopped && this.currentRequest?.id === id;
  }

  private endRequest(id: number): void {
    if (this.currentRequest?.id === id) {
      this.currentRequest = null;
    }
  }

  private setLoading(loading: boolean): void {
    if (this.loading === loading) {
      return;
    }
    this.loading = loading;
    this.host.emitLoading(loading);
  }

  private reportError(error: unknown): void {
    if (this.stopped || isAbortError(error)) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error ? error.name : "unknown";

    this.host.emitError(
      new WickError("DATAFEED_ERROR", message, {
        cause,
      }),
    );
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}
