# RFC-0010: Axis interaction and auto sizing

- Status: **Accepted** — implemented
- Date: 2026-10-27
- Depends on: RFC-0001 (accepted)

## 1. Context

The time axis could be panned and pinched but not zoomed by dragging the axis itself. The
price-axis strip was fixed at 64 CSS pixels, which is unnecessarily wide for short values and
too narrow for long or annotated values.

## 2. Goals

- Match the price-axis drag-to-zoom interaction on the time axis.
- Size the price-axis strip from the labels it must display.
- Keep the axis width bounded so charts cannot lose their plot area.
- Preserve the existing `interaction.axisDrag` opt-out.

## 3. Non-goals

- A public axis-width setter.
- Auto-sizing the time-axis height.
- Changing axis font metrics or truncating labels.
- Per-axis interaction flags.

## 4. Behavior

### Time-axis zoom

- Pointer down inside the bottom time-axis strip starts an axis drag.
- Horizontal movement zooms around the initial pointer position.
- Dragging right zooms in; dragging left zooms out.
- `interaction.axisDrag: false` disables both time-axis and price-axis dragging.
- The cursor is `ew-resize` over the time axis and `ns-resize` over the price axis.

### Auto width

- The price-axis width is measured from formatted price ticks, visible last values, and
  axis-visible price-line labels.
- Width includes 8 pixels of padding on each side.
- Bounds are 40–160 CSS pixels.
- A changed width triggers one relayout; the following render uses the stable width.
- The time axis remains 28 pixels high.

## 5. Acceptance criteria

- Dragging the time axis changes the visible time span.
- Price-axis dragging and double-click reset continue to work.
- Short prices produce a narrower axis than long price-line titles.
- Existing visual snapshots are refreshed for the new plot width.
