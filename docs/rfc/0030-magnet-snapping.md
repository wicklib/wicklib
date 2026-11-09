# RFC-0030: Weak, strong, and modifier magnet snapping

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0001 (accepted), RFC-0013 (accepted)

## 1. Context

The existing magnet mode only changed the crosshair event price to the nearest close. It did not
move the rendered crosshair, did not affect drawing anchors, and had no weak/strong distinction
or temporary keyboard activation.

## 2. Public API

`CrosshairOptions` gains:

- `magnet?: "weak" | "strong"` — strength while `mode: "magnet"` is active. Defaults to weak.
- `modifierMagnet?: "off" | "weak" | "strong"` — temporary strength while Ctrl or Command is held.
  Defaults to weak.

## 3. Weak magnet

- Uses the hovered pane's first OHLC series.
- Selects the closest of open, high, low, and close to the pointer price.
- Snaps the rendered crosshair price and the crosshair/click event payload.
- Uses the snapped price for drawing anchor placement and anchor dragging.
- Time remains aligned to the nearest bar.

## 4. Strong magnet

Strong magnet includes weak-magnet OHLC snapping plus:

- Existing drawing anchor points within 12 CSS pixels.
- Series price-line prices within 8 CSS pixels.

Snapping to a drawing anchor updates both time and price. Price-line and OHLC snaps update price.
When no stronger target is within range, strong magnet falls back to weak OHLC snapping.

## 5. Modifier activation

Holding Ctrl or Command temporarily activates `modifierMagnet` when it is not `"off"`. Releasing
the modifier restores the configured mode and re-evaluates the last pointer position. The modifier
also applies while placing drawing anchors and dragging anchors.

## 6. Acceptance criteria

- Weak magnet snaps crosshair and drawing prices to OHLC.
- Strong magnet snaps to drawing anchors and price lines.
- Ctrl/Command temporarily activates magnet without chart recreation.
- Crosshair visuals, events, drawing placement, and anchor dragging all use the same snap result.
- `mode: "magnet"` preserves backward compatibility and defaults to weak strength.
