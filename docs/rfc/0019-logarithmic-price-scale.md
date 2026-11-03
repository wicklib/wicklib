# RFC-0019: Logarithmic price scale

- Status: **Accepted** — implemented
- Date: 2026-11-03
- Depends on: RFC-0001 (accepted), RFC-0010 (accepted)

## 1. Context

`PriceScaleOptions.mode` has accepted `"logarithmic"` since the first public API, but the
implementation rejected it. Percentage moves matter more than absolute moves for long-range
charts, so a linear axis compresses recent action and over-emphasizes old highs.

## 2. Goals

- Render a logarithmic price axis without recreating the chart.
- Support logarithmic auto-scale, manual ranges, inversion, margins, formatting, and ticks.
- Keep normal mode behavior unchanged.
- Preserve the existing public option and lightweight-charts mapping.

## 3. Non-goals

- Percentage and indexed-to-100 scales.
- Multiple simultaneous price axes.
- Non-positive price support in logarithmic mode.
- Changes to drawing geometry or time scale behavior.

## 4. Public API

No new surface is required:

```ts
chart.setOptions({ priceScale: { mode: "logarithmic" } });
series.priceScale().setOptions({ mode: "logarithmic" });
```

`PriceScaleApi.getOptions().mode` reports the active mode.

## 5. Transform and range behavior

- Price-to-y and y-to-price transformations operate in natural-log space.
- `invertScale` applies after the log transform.
- Auto-range margins are applied to the logarithmic span, preserving proportional padding.
- A zero-width auto-range expands by 1% of the absolute log value, matching the linear
  degenerate-range behavior.
- Explicit ranges with `min <= 0` throw `INVALID_ARGUMENT`.
- Auto-ranges containing non-positive values are ignored; the previous valid range remains.
- Switching a manual negative range to logarithmic mode throws `INVALID_ARGUMENT`.
- Non-positive prices passed to `priceToY()` map to the low end of the axis rather than
  producing `NaN`.

## 6. Ticks

- Logarithmic ranges generate candidates from `1, 2, 3, 5, 7` and simpler mantissa sets per
  decade, choosing the densest set that stays near the target count.
- Ranges with a max/min ratio below 4 use ordinary linear ticks; the visual difference is
  negligible and decimal labels remain more familiar.
- The public `priceFormat` options still take precedence over inferred precision.
- Inferred logarithmic precision uses the most precise generated tick.

## 7. Acceptance criteria

- Log and linear transforms invert exactly.
- Auto-range margins are multiplicative in log space.
- Explicit non-positive ranges throw.
- Non-positive auto-ranges do not corrupt the current range.
- Ticks and labels remain inside the visible range.
- Existing linear scale and lightweight-charts tests continue to pass.
