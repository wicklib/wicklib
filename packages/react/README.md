# @wicklib/react

Thin React wrapper for Wicklib. No chart logic lives here; it mounts and disposes the core
chart and exposes it through context.

**Status: 0.1.0.** Requires React 18 or newer.

## Install

```sh
pnpm add @wicklib/core @wicklib/react react react-dom
```

## Usage

Give the wrapper a measurable size. `autoSize` is enabled by default.

```tsx
import { useEffect } from "react";
import { CandlestickSeries, type OhlcData } from "@wicklib/core";
import { WickChart, useChart } from "@wicklib/react";

function Series({ data }: { data: readonly OhlcData[] }) {
  const chart = useChart();

  useEffect(() => {
    if (!chart) {
      return;
    }
    const series = chart.addSeries(CandlestickSeries, { title: "BTC/USD" });
    series.setData(data);
    chart.timeScale().fitContent();
    return () => series.remove();
  }, [chart, data]);

  return null;
}

export function PriceChart({ data }: { data: readonly OhlcData[] }) {
  return (
    <WickChart style={{ height: 480 }}>
      <Series data={data} />
    </WickChart>
  );
}
```

`useChart()` returns `null` until the chart has mounted. Children of `WickChart` render
above the canvas, so toolbars and readouts can live inside the same wrapper.

## API

- `WickChart` — accepts every `ChartOptions` field plus `className`, `style`, `onChart`, and
  `children`. It creates the chart in an effect, so it is safe to import during SSR.
- `useChart()` — returns the chart from the nearest `WickChart`, or throws when used outside
  one.
- `onChart` — receives each created chart. React StrictMode creates and disposes a second
  chart during development checks.

## Option updates

Chart option props are patched with `chart.setOptions()`. Removing an option does not reset
it to the core default. Changing `extensions` recreates the chart and discards its series,
panes, indicators, and drawings because extensions are snapshotted at creation.

The wrapper does not provide declarative series, indicator, or drawing components. Use the
core `ChartApi` from `useChart()` or `onChart`. Core disposal is deferred by one microtask so
descendant effect cleanups can remove their series, indicators, and drawings before the chart
is destroyed.

## License

Apache-2.0.
