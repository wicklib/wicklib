# RFC-0003: Indicators and panes

- Status: **Accepted** — 2026-10-26; implemented
- Date: 2026-10-26
- Depends on: RFC-0001 (accepted), RFC-0002 (accepted)
- Out of scope: drawing tools (RFC-0004), standalone line/area/histogram series, multi-source
  indicators, WickScript, WebGL/workers

## 1. Context

Phase 2 renders one OHLC series in one pane with one price scale. Indicators need:

- typed inputs and deterministic computation;
- multiple plot lines per indicator;
- overlays on the price pane and separate panes;
- a shared time axis across panes;
- recomputation when a source series receives data.

The OHLC store is the only data model. Standalone line/area/histogram series would require a
generic store, so they are deferred. Indicator plots use the same render pipeline internally.

## 2. Goals

- Register and render indicators derived from one source series.
- Multiple panes with independent price scales and one shared time axis.
- Pure, deterministic indicator computation with typed inputs.
- Recompute only when source data or inputs change, coalesced before a frame.
- A free built-in catalog in `@wicklib/indicators`.
- Additive public API changes.

## 3. Non-goals

- Drawing tools and persistence (RFC-0004).
- Public `LineSeries` / `AreaSeries` / `HistogramSeries` tokens. They need a generic data
  store and a separate RFC.
- Multi-symbol or multi-timeframe indicators.
- Workers, WebGL, server-side computation.
- Strategy/backtest.

## 4. Principles

1. **An indicator is a pure function** of source bars and resolved inputs.
2. **Indicators never own datafeeds.** They read the source series' loaded bars.
3. **One time axis, many price scales.** Panes share time; each has its own price range.
4. **Dirty before render.** Recomputes coalesce into the next animation frame.
5. **No hidden state.** Indicator instances are owned by the chart.
6. **Additive only.** Existing RFC-0001/0002 signatures do not change.

## 5. Public surface

### 5.1 Indicator types

```ts
export type IndicatorInputValue = number | boolean | string;

export type IndicatorInputs = Record<string, IndicatorInputValue>;

export type SourceValue = "open" | "high" | "low" | "close" | "hl2" | "hlc3" | "ohlc4";

export interface IndicatorInputDefinition {
  id: string;
  name: string;
  type: "number" | "boolean" | "string" | "source";
  defaultValue: IndicatorInputValue;
  min?: number;
  max?: number;
  step?: number;
  /** Allowed values for string and source inputs. */
  options?: readonly string[];
}

export interface IndicatorPlotDefinition {
  id: string;
  title: string;
  type: "line" | "histogram" | "area";
  color?: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dotted" | "dashed";
  /** Histogram/area baseline. Defaults to 0. */
  baseline?: number;
  /** Initial visibility. Defaults to true. */
  visible?: boolean;
}
```

### 5.2 Source view and compute contract

```ts
export interface IndicatorBars {
  readonly length: number;
  timeAt(index: number): Time;
  openAt(index: number): number;
  highAt(index: number): number;
  lowAt(index: number): number;
  closeAt(index: number): number;
  /** Undefined when the source did not provide volume. */
  volumeAt(index: number): number | undefined;
}

export interface IndicatorContext<TInputs extends IndicatorInputs> {
  readonly bars: IndicatorBars;
  readonly inputs: Readonly<TInputs>;
}

/** One array per plot id, index-aligned with the source bars. */
export type IndicatorOutput = Readonly<Record<string, ReadonlyArray<number | null>>>;

export interface IndicatorDefinition<TInputs extends IndicatorInputs = IndicatorInputs> {
  readonly meta: ExtensionMeta;
  readonly inputs: readonly IndicatorInputDefinition[];
  readonly plots: readonly IndicatorPlotDefinition[];
  /** Default placement. Defaults to "main". */
  readonly defaultPane?: "main" | "separate";
  compute(context: IndicatorContext<TInputs>): IndicatorOutput;
}
```

Rules:

- Every output array MUST have `bars.length` entries.
- `null` marks a missing value (warm-up, no volume, undefined math).
- Values MUST be finite; `NaN` and `Infinity` are invalid.
- `compute` MUST be deterministic and perform no I/O, no wall clock, no randomness.
- The engine validates output before rendering. Invalid output is rejected and the previous
  plots remain.

### 5.3 Adding an indicator

```ts
export interface AddIndicatorOptions<TInputs extends IndicatorInputs = IndicatorInputs> {
  /** Defaults to the first series in the chart. */
  sourceSeriesId?: string;
  /** "main" uses the source pane, "separate" creates one, a string uses an existing pane. */
  pane?: "main" | "separate" | string;
  inputs?: Partial<TInputs>;
}

export interface IndicatorPlotOptions {
  color?: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dotted" | "dashed";
  visible?: boolean;
}

export interface IndicatorApi<TInputs extends IndicatorInputs = IndicatorInputs> {
  readonly id: string;
  readonly sourceSeriesId: string;
  readonly paneId: string;
  setInputs(inputs: Partial<TInputs>): void;
  setPlotOptions(plotId: string, options: IndicatorPlotOptions): void;
  remove(): void;
}

export interface ChartApi {
  // Existing members...
  addIndicator<TInputs extends IndicatorInputs>(
    definition: IndicatorDefinition<TInputs>,
    options?: AddIndicatorOptions<TInputs>,
  ): IndicatorApi<TInputs>;
}
```

- Inputs are merged over the definition defaults and validated before compute.
- `setInputs` recomputes; `setPlotOptions` does not.
- `remove` removes plots; an auto-created pane is removed when it becomes empty.
- Removing the source series removes its indicators and any auto-created panes.

### 5.4 Panes

```ts
export interface PaneOptions {
  /** Preferred height in CSS pixels. Remaining height is distributed equally. */
  height?: number;
  /** Price scale options for this pane. Defaults are used when omitted. */
  priceScale?: PriceScaleOptions;
}

export interface PaneApi {
  readonly id: string;
  setHeight(height: number): void;
  remove(): void;
}

export interface ChartApi {
  // Existing signature; now implemented.
  addPane(options?: PaneOptions): PaneApi;
}
```

- The default pane id is `main` and cannot be removed.
- New panes get ids `pane-1`, `pane-2`, and so on.
- `pane.remove()` cascades: its series and indicators are removed. Auto-created panes that
  become empty are removed by the engine.
- `SeriesOptions.paneId` is now honored. An unknown pane throws `INVALID_ARGUMENT`.
- `series.priceScale()` returns the containing pane's price scale.
- `addIndicator({ pane: "separate" })` creates a pane; `pane: "main"` overlays the source
  pane; a pane id targets an existing pane.

### 5.5 Events and errors

```ts
export interface ChartErrorEvent {
  error: WickError;
  source: "chart" | "series" | "extension" | "datafeed" | "indicator";
  seriesId?: string;
  indicatorId?: string;
}
```

- Invalid input or output emits `error` with `source: "indicator"` and `indicatorId`.
- `crosshair` and `click` report the **hovered pane id** and that pane's price.
- `visible-range` is emitted once per chart with `paneId: "main"` because time is shared.

## 6. Volume for VWAP

VWAP needs volume, which RFC-0001 did not include. Add it additively:

```ts
export interface OhlcData extends SeriesData {
  open: number;
  high: number;
  low: number;
  close: number;
  /** Optional. Non-negative and finite when present. */
  volume?: number;
}
```

- The store keeps a volume column; missing volume is `undefined`.
- Merges and updates carry volume.
- `IndicatorBars.volumeAt` returns `undefined` when absent.
- VWAP outputs `null` for bars without volume.
- Volume is not rendered in Phase 3; a volume series comes later.

## 7. Built-in catalog

`@wicklib/indicators` exports typed definitions:

| Definition       | Inputs                     | Plots                             | Default pane |
| ---------------- | -------------------------- | --------------------------------- | ------------ |
| `SMA`            | period, source             | line                              | main         |
| `EMA`            | period, source             | line                              | main         |
| `RSI`            | period, source             | line                              | separate     |
| `MACD`           | fast, slow, signal, source | macd line, signal line, histogram | separate     |
| `BollingerBands` | period, multiplier, source | upper, middle, lower lines        | main         |
| `VWAP`           | source                     | line                              | main         |
| `ATR`            | period                     | line                              | separate     |

- Pure computation helpers live in the package.
- Warm-up values are `null`.
- Defaults: SMA 20, EMA 20, RSI 14, MACD 12/26/9, Bollinger 20/2, ATR 14, source `close`
  (VWAP defaults to `hlc3`).
- `meta.license` is `"free"` for all seven.

## 8. Panes and rendering

- Panes stack vertically. The time axis is global and sits below the bottom pane.
- Each pane has its own right-side price axis and price scale; the plot width is shared.
- Vertical grid lines and the crosshair's vertical line span every pane.
- The crosshair's horizontal line and price label are limited to the hovered pane.
- Magnet snapping applies only when the hovered pane contains the source series; other panes
  use free price.
- Autoscale is per pane over visible series and plot values; `scaleMargins` apply per pane.
- Pane heights: preferred `height` if provided, remaining height split equally, minimum 60 px.
- Time labels render only under the bottom pane to avoid repetition.
- Indicator plots are internal: line, histogram, and area renderers on the series layer. They
  are not exposed as `SeriesApi`.

## 9. Recomputation

- Source `setData`, `update`, feed merge, and realtime revision mark dependent indicators
  dirty.
- Input changes mark the indicator dirty.
- Dirty indicators recompute once per frame before drawing; multiple data changes in one
  frame coalesce.
- Pan and zoom never recompute.
- Initial add with no source data produces empty plots until data arrives.
- A recompute over a 100k-bar source replaces the full plot arrays; view anchoring is handled
  by the existing time-scale logic.

## 10. Performance

- Target: 7 built-ins over 100k bars recompute in under 50 ms on the reference M2.
- Plot rendering iterates only visible indices.
- No recompute on pan/zoom or option-only changes.
- Worker offload is Phase 5; the definition contract stays the same.

## 11. Licensing

- `meta.license` is `"free"` or `"pro"`.
- Phase 3 core does not enforce licenses. Pro indicators are gated by the pro package before
  they are exposed.
- A chart-level `LicenseContext` can be added later without changing the indicator API.

## 12. Testing

- Golden fixtures for each built-in against known values, including warm-up `null`s.
- Input validation: missing, out of range, wrong type, invalid source.
- Output validation: wrong length, `NaN`, `Infinity`, missing plot id.
- Recompute on `setData`, feed merge/prepend, realtime revision, and `setInputs`.
- Dirty coalescing: multiple updates in one frame produce one compute.
- Pane layout: heights, minimums, shared time axis, removal cascade.
- Crosshair: pane id, price from the hovered pane, vertical line across panes.
- Auto-created separate panes removed when empty.
- Visual snapshot with SMA overlaid plus RSI and MACD panes.
- Benchmark with all seven indicators on 100k bars.

## 13. Open questions

Recommendations are what will be implemented unless overridden.

1. **Volume support** added now so VWAP is real. (recommended)
2. **Vectorized compute** over loaded bars now; incremental is a later optimization.
   (recommended)
3. **Internal indicator plots**, no public line/area/histogram series yet. (recommended)
4. **Pane removal cascades** to its contents. (recommended)
5. **Pane sizing** uses preferred pixels plus equal shares. (recommended)
6. **Default source** is the first series; explicit `sourceSeriesId` overrides.
   (recommended)
7. **Recompute coalescing** before the frame. (recommended)
8. **License metadata only** in Phase 3. (recommended)
9. **Magnet only in the source pane.** (recommended)
10. **Auto-created panes removed when empty.** (recommended)

## 14. Acceptance criteria

- The ten decisions are settled.
- Panes render with independent price scales and a shared time axis.
- All seven indicators compute and render, including separate panes.
- Indicator recompute is coalesced and tested.
- Invalid input/output is reported and leaves the previous plots intact.
- Visual regression covers an indicator + multi-pane layout.
- Benchmark covers all seven indicators on 100k bars.
- API report regenerated and reviewed.

## 15. Implementation sequence

1. Add optional volume to `OhlcData`, the store, and the datafeed merge path.
2. Refactor the chart into a pane model: layout, per-pane price scales, shared time axis,
   renderer, crosshair.
3. Add indicator types, input resolution, chart ownership, and source binding.
4. Add dirty recompute and plot data alignment.
5. Add internal line/histogram/area plot renderers.
6. Implement `@wicklib/indicators` built-ins and tests.
7. Implement `chart.addIndicator`, `IndicatorApi`, and pane integration.
8. Update the playground with SMA/EMA overlays and RSI/MACD panes.
9. Add visual regression and the indicator benchmark.
10. Regenerate the API report and update docs.
