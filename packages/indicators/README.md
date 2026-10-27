# @wicklib/indicators

Free built-in indicator catalog for Wicklib.

- `SMA`, `EMA` — moving averages (main pane)
- `RSI`, `ATR` — oscillators (separate pane)
- `MACD` — line, signal, histogram (separate pane)
- `BollingerBands` — three lines (main pane)
- `VWAP` — session VWAP from typical price and volume (main pane)

Every definition is an `IndicatorDefinition` token; register it with
`chart.addIndicator(definition, options)`.

```ts
import { CandlestickSeries, createChart } from "@wicklib/core";
import { SMA } from "@wicklib/indicators";

const chart = createChart(container);
const series = chart.addSeries(CandlestickSeries);
series.setData(bars);

chart.addIndicator(SMA, { inputs: { period: 50, source: "close" } });
```

Definitions are pure: inputs are typed and validated by the core, warm-up values are `null`,
and computation performs no I/O. Volume is optional; `VWAP` returns `null` where volume is
missing.

## License

Apache-2.0.
