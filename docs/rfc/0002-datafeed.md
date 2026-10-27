# RFC-0002: Datafeed contract

- Status: **Accepted** — 2026-10-26; implemented
- Date: 2026-10-26
- Depends on: RFC-0001 (accepted)
- Out of scope: indicators, drawings, multi-timeframe alignment, server-side execution, caching

## 1. Context

RFC-0001 deliberately left data loading out. A chart that only accepts `setData` cannot
pan into history or stream live bars. The datafeed is the contract between the host
application and a series for turning a visible time range into data.

Wicklib performs no I/O. The datafeed owns transport, authentication, caching, retries, and
reconnect. The core owns request planning, merging, anchoring, cancellation, and rendering.

## 2. Goals

- Load history on demand as the user pans, without jumps or duplicate requests.
- Stream live updates through the same data path.
- One in-flight request per series; stale requests are aborted.
- Predictable loading and error states.
- Keep the public API additive to RFC-0001.
- Support multiple series with independent feeds, including multiple symbols.

## 3. Non-goals

- No WebSocket, REST, or vendor code in the library.
- No caching policy, retry policy, or reconnection logic in the library.
- No symbol resolution or market metadata. The host supplies `symbol` and `interval`.
- No indicators, panes, or multi-timeframe alignment in this RFC.

## 4. Principles

1. **Series owns its data source.** A series can use `setData` or a datafeed, never both.
2. **The host owns the network.** The core calls the feed and never assumes a transport.
3. **Range requests are explicit.** The core asks for exactly the missing range plus a
   prefetch buffer.
4. **Merges are deterministic.** Sorted, unique by time, duplicates replaced by the newer
   value.
5. **The view does not jump.** Prepending history preserves the visible time range.
6. **Failures are visible.** Errors are typed and emitted; existing data stays on screen.

## 5. Public surface

### 5.1 Types

```ts
export interface DatafeedContext {
  /** Aborted when the request is no longer needed. */
  signal: AbortSignal;
}

export interface DataRequest {
  symbol: string;
  interval: Interval;
  /** Inclusive lower bound. Used for range loads. */
  from?: Time;
  /** Inclusive upper bound. Used for range loads. */
  to?: Time;
  /** Number of latest bars to return. Used for the initial load. */
  count?: number;
}

export interface DataResponse<TData extends SeriesData = SeriesData> {
  /** Ascending, unique by time. May be empty. */
  data: readonly TData[];
  /** True when no data exists earlier than the requested range. */
  noDataBefore?: boolean;
  /** True when no data exists later than the requested range. */
  noDataAfter?: boolean;
}

export interface SubscriptionRequest {
  symbol: string;
  interval: Interval;
}

export interface Datafeed<TData extends SeriesData = SeriesData> {
  getData(request: DataRequest, context: DatafeedContext): Promise<DataResponse<TData>>;

  subscribe?(
    request: SubscriptionRequest,
    listener: (data: TData) => void,
    onError: (error: unknown) => void,
  ): Unsubscribe;
}

export interface SeriesDatafeedOptions {
  symbol: string;
  interval: Interval;
  /** Bars requested on the initial load. Defaults to 500. */
  initialBars?: number;
}
```

- `count` takes precedence when present. The core never sends `count` and `from`/`to`
  together.
- `from`/`to` are inclusive.
- `noDataBefore` / `noDataAfter` let the core stop extending a direction. They are hints,
  not errors.

### 5.2 Series additions

```ts
export interface SeriesApi<TData extends SeriesData, TOptions extends SeriesOptions> {
  /**
   * Replaces manual data with a feed. Clears the store and starts the initial load.
   * Calling again with a different symbol or interval clears and restarts.
   */
  setDatafeed(feed: Datafeed<TData>, options: SeriesDatafeedOptions): void;

  /** Stops requests and subscriptions. Keeps already loaded data. */
  clearDatafeed(): void;

  /** True while the initial or range loads are in flight. */
  isLoading(): boolean;

  // Existing: setData, update, setOptions, priceScale, remove
}
```

Ownership rules:

- `setData` or `update` on a series with a feed throws
  `WickError("INVALID_ARGUMENT", "Series is driven by a datafeed")`.
- `setDatafeed` clears manually supplied data and replaces the source.
- `clearDatafeed` keeps the loaded bars; call `setData([])` to clear them.
- `remove()` and `chart.destroy()` abort in-flight requests and unsubscribe.

### 5.3 Events

```ts
export interface DataLoadingEvent {
  seriesId: string;
  loading: boolean;
}

export interface ChartEventMap {
  // Existing keys...
  "data-loading": DataLoadingEvent;
}

export interface ChartErrorEvent {
  error: WickError;
  source: "chart" | "series" | "extension" | "datafeed";
  /** Present when the error came from a series feed. */
  seriesId?: string;
}
```

- `loading` transitions to `true` when the first request starts and to `false` when every
  in-flight request has settled (success, error, or abort).
- Errors are reported through `error` with `source: "datafeed"`. Existing data remains.
- The core does not draw a loading spinner. The host decides the UI.

## 6. Behavior

### 6.1 Initial load

`setDatafeed(feed, { symbol, interval, initialBars })`:

1. Clear the series store and any previous feed.
2. Request `{ symbol, interval, count: initialBars ?? 500 }`.
3. Merge the response.
4. If this is the primary series and the host has not set an explicit visible range, fit the
   loaded bars with a small margin. Otherwise keep the current view.
5. Start `subscribe` if provided.

### 6.2 Range loads

On every visible range change:

1. Debounce for 120 ms.
2. Find the missing left and right ranges relative to the loaded data.
3. Expand each missing range by 50% of the visible span (prefetch).
4. Abort the previous in-flight request for the series.
5. Request the missing range with `{ symbol, interval, from, to }`.
6. Merge, then restore the visible time range.

No request is made when the visible range is already covered by the prefetch buffer.
`noDataBefore` / `noDataAfter` stops requests in that direction.

### 6.3 Merge and anchoring

- Bars are sorted ascending and unique by time.
- Duplicate times replace the existing bar (feed corrections).
- Invalid data is rejected as `WickError("DATAFEED_ERROR")`; the store is unchanged.
- Prepending `N` historical bars shifts indices by `N`. The controller adjusts the time
  scale so the same time range stays visible. The chart must not jump.
- Appending historical bars on the right keeps the current view.
- Realtime bars: if the right edge is at or near the last bar, follow the new bar; if the
  user has panned back, do not move the view.

### 6.4 Realtime

- `subscribe` is started after the initial load succeeds.
- Same time as the last bar replaces it (revision).
- Later time appends.
- Earlier time is ignored. It is not an error; feeds may replay after reconnect.
- The feed owns reconnection. If it reports an error, the core emits `error` and keeps the
  existing data and subscription until the feed unsubscribes.

### 6.5 Loading and errors

- `getData` rejection is wrapped as `WickError("DATAFEED_ERROR")` with the cause in
  `details`.
- `AbortError` is not an error and is not emitted.
- A response with unsorted, duplicate, or invalid bars is rejected before merging.
- Loading state is false after all requests settle, including failures.
- The last good data stays visible.

### 6.6 Cancellation

- One in-flight range request per series. A new request aborts the previous one.
- `clearDatafeed`, `remove`, and `destroy` abort the request and unsubscribe.
- Aborted promises are ignored.
- The initial load is also abortable.

## 7. Multiple series and the time axis

- Each series has its own independent feed and loaded range.
- In Phase 2 the first series is the primary and drives the time axis. A later RFC can add
  an explicit `primarySeries` option.
- Overlays can use `setData` while the primary uses a feed.
- A series with a feed must not be updated with `setData`/`update`.

## 8. SSR and units

- Importing the package is safe in SSR. Datafeed requests only start after `createChart`.
- Time is milliseconds since the Unix epoch, as in RFC-0001.
- The core never calls `Date.now()` to decide what to load. The feed decides "latest".

## 9. Changes to RFC-0001 types

All additive:

- `SeriesApi`: `setDatafeed`, `clearDatafeed`, `isLoading`.
- `ChartEventMap`: `"data-loading"`.
- `ChartErrorEvent`: optional `seriesId`.
- New datafeed types.

No existing signature changes.

## 10. Testing

Mock feed with controllable promises:

- initial `count` load, then range loads on pan.
- prefetch does not duplicate requests.
- abort on rapid pan (only the last request resolves).
- `noDataBefore` / `noDataAfter` stop extension.
- prepend keeps the visible time range.
- realtime replace/append/ignore-older.
- invalid response rejected and existing data preserved.
- error event with `seriesId`.
- `clearDatafeed`, `remove`, `destroy` abort and unsubscribe.
- loading event transitions.

## 11. Open questions

Recommendations are what will be implemented unless overridden.

1. **Series-level feed** as the primitive, no chart-level `setDatafeed` yet. (recommended)
2. **Generic `getData`** instead of `getBars`, so line series can reuse it. (recommended)
3. **Initial load by `count`**, default 500. (recommended)
4. **Auto-fit the first load** only when no explicit range was set. (recommended)
5. **Debounce 120 ms**, prefetch 50% of the visible span. (recommended)
6. **`noDataBefore` / `noDataAfter`** flags. (recommended)
7. **Prepend keeps the view fixed; realtime follows only at the right edge.** (recommended)
8. **Add optional `seriesId` to `ChartErrorEvent`.** (recommended)
9. **Chart-level convenience feed** deferred. (recommended)

## 12. Acceptance criteria

- The nine decisions are settled.
- Types updated; API report regenerated.
- Mock-feed tests cover load, abort, merge, anchoring, realtime, errors, and teardown.
- The playground gets an async mock feed with simulated latency and a loading indicator.

## 13. Implementation sequence

1. Add types and `SeriesApi` methods.
2. Implement the series data controller: initial load, debounce, range planning, abort.
3. Implement merge with prepend anchoring and realtime revision.
4. Wire `data-loading`, `error`, `clearDatafeed`, `remove`, `destroy`.
5. Add mock-feed tests.
6. Update the API report.
7. Add an async mock-feed page to the playground.
