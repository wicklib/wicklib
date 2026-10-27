# RFC-0001: Public chart and series API

- Status: **Accepted** — 2026-10-26
- Date: 2026-10-26
- Supersedes: the Phase 1 stub surface in `packages/core/src/index.ts`
- Out of scope: datafeed (RFC-0002), indicators and drawings (RFC-0003), panes, WickScript,
  commercial features, sessions/DST

## 1. Context

Phase 1 froze a placeholder surface to prove the pipeline and lock the package boundary. The
placeholders are deliberately shallow: `addSeries(extension)` takes an untyped extension,
`Chart` returns string ids, and there is no way to express a typed series.

Implementing the renderer against those placeholders would force either a rewrite or a
permanent compromise. This RFC replaces them before any rendering code exists. Changing the
public API now is expected and must be a reviewed API report diff, not an accident.

## 2. Goals

- A small, typed, explicit API that survives the first stable release.
- One obvious way to do each thing.
- No hidden global state, so multiple charts on one page are independent.
- Type inference for series data and options without casts.
- Additive evolution: later features (panes, indicators, script, pro) do not require
  breaking the shape defined here.
- Import-safe in SSR; DOM required only when a chart is created.

## 3. Non-goals

- Data loading. The contract is RFC-0002.
- Indicators, drawings, panes, layouts, scripting, licensing enforcement.
- WebGL, workers, offscreen rendering.
- Session gaps, holidays, DST. Continuous time only.

## 4. Principles

1. **Tokens over strings.** Series types are imported values, not magic strings. Strings are
   added later only where a runtime lookup is genuinely required (script runtimes).
2. **Explicit registration.** Extensions are passed to `createChart`. There is no global
   mutable registry.
3. **Fail loudly.** Invalid data and misuse throw a typed `WickError`. Nothing is silently
   ignored.
4. **Data in, pixels out.** Core performs no I/O, no persistence, no account access.
5. **Immutable inputs.** The chart never mutates caller arrays.
6. **One code path.** Whatever renders in the playground renders in production.

## 5. Public surface

### 5.1 Entry point

```ts
export function createChart(container: HTMLElement, options?: ChartOptions): ChartApi;
```

`createChart` is client-only. Importing the package in SSR must be safe; calling it without
a DOM throws `WickError("INVALID_ARGUMENT")`.

### 5.2 Time and data

```ts
/** Milliseconds since the Unix epoch, UTC. */
export type Time = number;

/** Opaque interval label, for example "1m", "1h", "1D". */
export type Interval = string;

export interface SeriesData {
  time: Time;
}

export interface OhlcData extends SeriesData {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface LineData extends SeriesData {
  value: number;
}
```

Milliseconds are chosen because JavaScript dates and most charting data sources use them.
Adapters that receive seconds normalize at the edge. The chart does not guess.

### 5.3 Series type tokens

```ts
export interface SeriesType<
  TData extends SeriesData = SeriesData,
  TOptions extends SeriesOptions = SeriesOptions,
> {
  readonly id: string;
  readonly meta: ExtensionMeta;
}

export const CandlestickSeries: SeriesType<OhlcData, CandlestickSeriesOptions>;
export const LineSeries: SeriesType<LineData, LineSeriesOptions>;
export const AreaSeries: SeriesType<LineData, AreaSeriesOptions>;
export const HistogramSeries: SeriesType<LineData, HistogramSeriesOptions>;
```

Only `CandlestickSeries` is implemented in Phase 2. The others are exported as tokens once
their renderers land; they must not be exported as empty shells.

Third-party series types use the same token shape and are supplied through `extensions`.
The factory used to create them is specified in RFC-0003; the token shape above is final.

### 5.4 Chart

```ts
export interface ChartApi {
  addSeries<TData extends SeriesData, TOptions extends SeriesOptions>(
    type: SeriesType<TData, TOptions>,
    options?: TOptions,
  ): SeriesApi<TData, TOptions>;

  addPane(options?: PaneOptions): PaneApi;

  timeScale(): TimeScaleApi;

  /** Applies chart options. `extensions` cannot change after creation. */
  setOptions(options: Partial<ChartOptions>): void;

  on<K extends keyof ChartEventMap>(
    event: K,
    handler: (payload: ChartEventMap[K]) => void,
  ): Unsubscribe;

  resize(): void;

  destroy(): void;
}
```

`addPane` exists in the type now and is implemented in Phase 3. Calling it before then
throws `WickError("NOT_IMPLEMENTED")`. It is defined now so adding panes later is additive.

### 5.5 Series

```ts
export interface SeriesApi<
  TData extends SeriesData = SeriesData,
  TOptions extends SeriesOptions = SeriesOptions,
> {
  readonly id: string;
  readonly paneId: string;

  setData(data: readonly TData[]): void;
  update(data: TData): void;
  setOptions(options: Partial<TOptions>): void;

  priceScale(): PriceScaleApi;

  remove(): void;
}
```

There is no `chart.removeSeries(id)`. `series.remove()` is the single way to remove a series;
two removal paths invite inconsistent state.

### 5.6 Options

```ts
export interface ChartOptions {
  autoSize?: boolean; // default true
  width?: number; // required when autoSize is false
  height?: number; // required when autoSize is false
  locale?: string; // default "en-US"
  timezone?: string; // IANA, default "UTC"
  layout?: LayoutOptions;
  grid?: GridOptions;
  crosshair?: CrosshairOptions;
  timeScale?: TimeScaleOptions;
  priceScale?: PriceScaleOptions;
  extensions?: readonly WickExtension[];
}

export interface SeriesOptions {
  title?: string;
  visible?: boolean;
  paneId?: string;
  priceScaleId?: string;
  lastValueVisible?: boolean;
  priceLineVisible?: boolean;
}

export interface CandlestickSeriesOptions extends SeriesOptions {
  upColor?: string;
  downColor?: string;
  wickUpColor?: string;
  wickDownColor?: string;
  borderVisible?: boolean;
}

export interface LineSeriesOptions extends SeriesOptions {
  color?: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dotted" | "dashed";
}
```

Options are additive. Unknown keys are ignored today and reserved; they must not be used to
smuggle behavior. Every documented option is either implemented or throws.

### 5.7 Events

```ts
export type Unsubscribe = () => void;

export interface ChartEventMap {
  ready: void;
  crosshair: CrosshairEvent;
  "visible-range": VisibleRangeEvent;
  click: ChartClickEvent;
  error: ChartErrorEvent;
}

export interface Point {
  x: number;
  y: number;
}

export interface CrosshairEvent {
  time: Time | null;
  price: number | null;
  paneId: string;
  point: Point | null;
}

export interface VisibleRangeEvent {
  from: Time;
  to: Time;
  paneId: string;
}

export interface ChartClickEvent {
  time: Time | null;
  price: number | null;
  paneId: string;
  point: Point;
  button: "left" | "middle" | "right";
}

export interface ChartErrorEvent {
  error: WickError;
  source: "chart" | "series" | "extension" | "datafeed";
}
```

Dispatch rules:

- Handlers run synchronously, in registration order.
- A throwing handler is isolated: remaining handlers still run, and the exception is
  reported through `error` with `source: "chart"`.
- A throwing `error` handler is swallowed to avoid recursion.
- Unsubscribing is idempotent and safe after `destroy()`.

### 5.8 Time scale

```ts
export interface VisibleRange {
  from: Time;
  to: Time;
}

export interface TimeScaleApi {
  getVisibleRange(): VisibleRange;
  setVisibleRange(range: VisibleRange): void;
  fitContent(): void;
  scrollToTime(time: Time): void;
  setOptions(options: Partial<TimeScaleOptions>): void;
}
```

### 5.9 Price scale

```ts
export interface PriceRange {
  min: number;
  max: number;
}

export interface PriceScaleApi {
  getVisibleRange(): PriceRange;
  setVisibleRange(range: PriceRange): void;
  setAutoScale(enabled: boolean): void;
}
```

### 5.10 Extensions

```ts
export type ExtensionKind = "series" | "indicator" | "drawing" | "script-runtime" | "feature";

export type LicenseTier = "free" | "pro";

export interface ExtensionMeta {
  id: string; // reverse-DNS, e.g. "com.wicklib.orderflow"
  name: string;
  version: string;
  license: LicenseTier;
}

export interface WickExtension {
  readonly kind: ExtensionKind;
  readonly meta: ExtensionMeta;
}
```

- Extensions are passed in `ChartOptions.extensions` and snapshot at creation. Mutating an
  array after creation has no effect.
- `registerExtension` is removed. There is no process-wide registry.
- Duplicate extension ids throw `WickError("DUPLICATE_EXTENSION")`.
- Extensions may not import core internals; they implement the public contracts only.

### 5.11 Errors

```ts
export type WickErrorCode =
  | "INVALID_ARGUMENT"
  | "INVALID_DATA"
  | "NOT_IMPLEMENTED"
  | "LICENSE_REQUIRED"
  | "DUPLICATE_SERIES"
  | "DUPLICATE_EXTENSION"
  | "UNKNOWN_SERIES_TYPE"
  | "DATAFEED_ERROR"
  | "DISPOSED";

export class WickError extends Error {
  readonly code: WickErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
}

export function isWickError(value: unknown): value is WickError;
```

No string throws. No silent fallbacks.

### 5.12 Disposal

- `destroy()` is idempotent.
- After `destroy()`, every method on the chart and its series throws
  `WickError("DISPOSED")`, except `destroy()` and previously returned unsubscribes.
- Listeners are cleared; the canvas and observers are released.

## 6. Behavior rules

### Data validation

`setData` validates the entire array before rendering:

- `time` is a finite, non-negative integer in milliseconds.
- Times are strictly ascending and unique.
- OHLC values are finite.
- `high >= max(open, close)` and `low <= min(open, close)`.
- No `NaN`, no `Infinity`, no `null`.

Any violation throws `WickError("INVALID_DATA")` with the index in `details`.

### Update semantics

`update(data)`:

- Same `time` as the last bar replaces it (revision).
- Later `time` appends.
- Earlier `time` throws `WickError("INVALID_DATA")`.

This is the only realtime update contract. It is designed to also serve RFC-0002.

### Multiple charts

Charts share nothing mutable. Built-in tokens are immutable singletons. Removing a series in
one chart cannot affect another.

### SSR

Importing is safe. `createChart` requires a DOM. `@wicklib/react` is responsible for
client-only mounting.

## 7. Changes from the Phase 1 stubs

| Phase 1                                       | RFC-0001                              |
| --------------------------------------------- | ------------------------------------- |
| `addSeries(extension: WickExtension): string` | `addSeries(type, options): SeriesApi` |
| `chart.removeSeries(id)`                      | `series.remove()` only                |
| `chart.subscribe(event, listener)`            | `chart.on(event, handler)`            |
| `registerExtension(extension)`                | `ChartOptions.extensions`             |
| `Chart`                                       | `ChartApi`                            |
| `Bar`                                         | `OhlcData`                            |
| `Datafeed` stub                               | deferred to RFC-0002                  |
| `ScriptRuntime` registration                  | via `extensions`, shape unchanged     |
| `Feature`, `LicenseContext`, `assertFeature`  | unchanged                             |

This is a deliberate 0.x reset. After acceptance, breaking changes require an ADR and a
major release.

## 8. Compatibility

- Package version remains `0.1.0-dev.x` during Phase 2.
- The accepted RFC is the contract; the API report is regenerated once, reviewed, and
  committed.
- Every later public addition must be additive.

## 9. Performance

- Public input is an array of objects; internally normalized to typed arrays.
- No per-bar object allocation inside the render loop.
- Columnar input (`Float64Array` columns) is a later additive optimization, not part of v1.
- Target: 100k bars, 60fps pan/zoom on a mid-range laptop.

## 10. Testing

- Unit: validation, update semantics, event dispatch and isolation, disposal, multi-chart
  independence.
- Type-level: `addSeries` infers data and options; invalid data is a compile error.
- Visual: Playwright screenshots of the playground.
- API: report diff reviewed.

## 11. Open questions

Recommendations are what will be implemented unless overridden.

1. **Time unit:** milliseconds. (recommended) Seconds are normalized by adapters.
2. **Series identity:** opaque tokens. (recommended) String lookup is added only for script
   runtimes, via a separate method, not by widening `addSeries`.
3. **Registration:** per-chart `extensions`. (recommended) No global registry.
4. **Removal:** `series.remove()` only. (recommended)
5. **Event isolation:** catch handler exceptions and surface through `error`. (recommended)
6. **Default timezone:** `UTC`, with IANA override. (recommended) Local time is a one-line
   option, not a hidden default.
7. **Validation:** strict OHLC invariants. (recommended) Bad vendor data should fail at the
   boundary, not render a lie.
8. **Panes:** types defined now, implementation Phase 3. (recommended)
9. **Columnar input:** deferred. (recommended)

## 12. Acceptance criteria

- The nine open questions are decided.
- Types in `packages/core` match this document.
- API report regenerated and reviewed.
- The playground uses only this public API.
- No out-of-scope feature is implemented.

## 13. Implementation sequence

1. Update types and exports to match this RFC.
2. Regenerate `etc/core.api.md` and review the diff.
3. Scaffold `apps/playground` with synthetic data using `setData`.
4. Build data/scales, renderer, lifecycle, candlestick series, axes, interactions.
5. Write RFC-0002 (datafeed) before implementing data loading.
