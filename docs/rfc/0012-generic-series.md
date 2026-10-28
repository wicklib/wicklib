# RFC-0012: Generic series and line, area, and histogram types

- Status: **Accepted** — implemented
- Date: 2026-10-27
- Depends on: RFC-0001 (accepted), RFC-0002 (accepted), RFC-0003 (accepted)

## 1. Context

Core rendering was candlestick-only even though the public API exposed line-series option
types. The generic store was deferred until a real need appeared. Line, area, and histogram
series are now required to make Wicklib a general charting engine.

## 2. Goals

- Separate series storage from OHLC storage.
- Support `LineData` through a columnar store.
- Add working `LineSeries`, `AreaSeries`, and `HistogramSeries` tokens.
- Keep datafeeds, markers, price lines, last values, legends, and auto-scaling working for
  every built-in series kind.
- Keep indicators candlestick-only until a generic indicator input model exists.

## 3. Non-goals

- Custom series renderers or renderer plugins.
- Multiple price axes or overlay scales.
- Time-series revision mode.
- Indicator computation over line series.
- Multi-symbol or multi-timeframe series.

## 4. Public API

```ts
const LineSeries: SeriesType<LineData, LineSeriesOptions>;
const AreaSeries: SeriesType<LineData, AreaSeriesOptions>;
const HistogramSeries: SeriesType<LineData, HistogramSeriesOptions>;

interface LineSeriesOptions extends SeriesOptions {
  color?: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dotted" | "dashed";
}

interface AreaSeriesOptions extends LineSeriesOptions {
  topColor?: string;
  bottomColor?: string;
  lineColor?: string;
}

interface HistogramSeriesOptions extends SeriesOptions {
  color?: string;
  base?: number;
}
```

## 5. Behavior

- `LineData` requires a non-negative integer millisecond time and a finite value.
- Line, area, and histogram data use the same ascending/unique/revision rules as OHLC.
- Line and area auto-scale from visible values.
- Histogram auto-scale includes its baseline.
- Area fills from the line to the pane bottom using `topColor` → `bottomColor`.
- Histogram bars extend from `base` to each value.
- Markers, price lines, last-value labels, and legends work on every built-in kind.
- Indicators require a candlestick source series.
- Datafeeds use the same controller and merge semantics as candlestick series.

## 6. Acceptance criteria

- All four built-in series kinds can coexist in a pane.
- Line datafeeds load and merge correctly.
- Histogram baselines affect auto-scale.
- Indicators reject non-candlestick sources.
- Existing candlestick behavior is unchanged.
