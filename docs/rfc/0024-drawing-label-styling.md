# RFC-0024: Per-drawing label styling

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0004 (accepted), RFC-0023 (accepted)

## 1. Context

Drawing labels currently use the chart layout font size and always draw a filled background with
white text. Hosts need larger Elliott degree labels and boxless labels without changing chart
chrome or the Text tool.

## 2. Public API

```ts
interface DrawingOptions {
  labelFontSize?: number;
  labelBackgroundVisible?: boolean;
}
```

Defaults:

- `labelFontSize` is omitted, falling back to the chart layout font size.
- `labelBackgroundVisible` is `true`.

## 3. Behavior

- The label font size is independent of the Text tool's `fontSize`.
- Boxless labels skip the background rectangle.
- Boxless text uses the caller-supplied label color, falling back to the drawing color.
- Elliott, Fibonacci, range, position, Gann, angle, channel, measure, and stats labels share the
  same behavior.
- Changes apply immediately through `DrawingApi.setOptions()` and persist in serialized options.
- Invalid non-positive label font sizes throw `INVALID_ARGUMENT`.

## 4. Acceptance criteria

- Default labels remain boxed and use the chart layout size.
- A 24 px Elliott label renders at 24 px.
- Boxless labels skip the label background and do not use white text.
- Existing drawing documents load unchanged.
