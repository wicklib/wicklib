# RFC-0022: Visible and current last-value labels

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0001 (accepted), RFC-0007 (accepted)

## 1. Context

The last-value label currently follows the last bar inside the visible time range. When the user
pans back, the label follows the right edge and the current/newest data price is no longer
visible on the axis.

## 2. Goals

- Keep the existing visible-edge behavior by default.
- Allow the label to follow the newest data point.
- Allow both visible and current labels at once.
- Expose both values through the public series API.
- Clamp an off-screen current price to the axis with a directional marker.

## 3. Non-goals

- Changing the price-line or legend defaults.
- Multiple current-price lines.
- Per-chart default modes.
- Server-side state.

## 4. Public API

```ts
series.setOptions({ lastValueMode: "visible" | "data" | "both" });

series.lastValue();
series.visibleLastValue();
```

`lastValue()` returns the newest data point, even when outside the visible range.
`visibleLastValue()` returns the last value at the visible right edge. Both return
`{ value, time, index, visible }` or `null`.

## 5. Behavior

- `visible` is the default and preserves existing rendering.
- `data` follows the newest data point.
- `both` draws the visible label and a separate current label.
- Current labels outside the price range clamp to the top/bottom and use `▲`/`▼`.
- Overlapping labels are offset.
- Equal visible/data indices collapse to one label.
- The price line remains tied to the visible edge; the legend remains visible-edge based.
- Axis-width measurement includes both values when `both` or `visible` is active.

## 6. Acceptance criteria

- Default rendering is unchanged.
- Panning back with `both` shows both values.
- `lastValue()` and `visibleLastValue()` report the correct indices and values.
- Off-screen current labels are clamped and marked.
- Axis width and existing label tests continue to pass.
