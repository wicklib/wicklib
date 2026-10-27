# RFC-0009: Price-line title placement

- Status: **Accepted** — implemented
- Date: 2026-10-27
- Depends on: RFC-0007 (accepted)

## 1. Context

Price-line titles currently render only inside the price-axis label. Notebook and trade-journal
hosts need entry, exit, stop-loss, and take-profit titles visible inside the plot near the
line, without giving up the axis value label.

## 2. Goals

- Add an explicit title placement option.
- Preserve existing axis-title behavior as the default.
- Keep the price value available on the axis when the title moves into the plot.
- Avoid a second price-line annotation system.

## 3. Non-goals

- Arbitrary title positions or draggable labels.
- Multi-line or rich-text titles.
- Moving the price value itself into the plot.

## 4. Public API

```ts
type PriceLineTitlePosition = "axis" | "plot";

interface PriceLineOptions {
  // existing fields...
  titlePosition?: PriceLineTitlePosition;
}
```

Default: `axis`.

## 5. Behavior

- `axis`: the axis label contains `title + price`, unchanged from RFC-0007.
- `plot`: the title is drawn inside the plot near the right edge of the line; the axis
  label, when visible, contains only the price.
- `titlePosition: "plot"` with `axisLabelVisible: false` shows only the in-plot title.
- An empty title produces no in-plot label.
- Invalid positions throw `INVALID_ARGUMENT`.

## 6. Acceptance criteria

- Existing price lines render unchanged by default.
- A plot-positioned title renders inside the plot.
- The price-axis value remains visible unless explicitly disabled.
- The behavior is covered by rendering tests.
