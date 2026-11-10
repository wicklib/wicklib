# RFC-0032: Drawing interaction polish

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0013 (accepted), RFC-0028 (accepted), RFC-0029 (accepted)

## 1. Context

Several drawing tools needed hit-testing, handle, text, and transient-tool corrections.

## 2. Changes

- Channel interiors are click-through. Only channel lines and handles participate in hit testing.
- Arrow uses trend-line presentation: extensions, styled text, and optional price/time labels.
- Horizontal and vertical lines constrain dragging to their perpendicular axis, share the same
  default colour, support styled text, and expose price/time axis labels. Axis labels default to
  selected mode.
- Cross Line supports price and time axis labels with the same selected default.
- Rectangle stores two anchors but renders eight virtual handles: four corners and four edge
  midpoints. Corner and edge handles resize the rectangle. Added text, extend left/right, fill
  visibility, and middle-line colour/width/style settings.
- Position stats add `lossPercent` and include it in default position stats.
- Measure is transient: it is removed on the next chart interaction or new drawing tool, has no
  drawing settings, and is never serialized.
- Path drawings expose a handle for every authored vertex.
- All selection knobs use an 8px rounded 4px radius.

## 3. Notes

The visible-bar zoom lock is a host-level `maxVisibleBars` policy. Wickscreen should compute it per
timeframe rather than using one global value.

## 4. Acceptance criteria

- Empty channel interiors allow clicks to pass through.
- Arrow and trend line presentation settings are consistent.
- Horizontal/vertical handles stay on their constrained axes.
- Rectangle has eight working handles and the new style controls.
- Measure disappears after use and exposes no settings.
- Path vertices are editable.
- Knobs are rounded.
