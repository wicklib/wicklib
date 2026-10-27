# ADR-0001: Drawing anchors do not inherit crosshair magnet

- Status: **Accepted**
- Date: 2026-10-27
- Relates to: RFC-0004

## Context

RFC-0004 originally allowed drawing anchors to take their price from the crosshair magnet
mode. In practice this made placement depend on the nearest candle close rather than the
pointer position. On dense data the anchor could jump far from the click, which looked like
random placement. Moving and anchor editing already behaved correctly.

## Decision

Drawing creation and anchor editing use the pointer's price coordinate directly. Time still
snaps to the nearest bar time because anchors must remain stable on the shared time axis.
Crosshair magnet mode continues to affect the crosshair readout only.

## Consequences

- Clicking places a drawing at the cursor position regardless of crosshair mode.
- Price snapping for annotations is removed; it can return later as an explicit drawing
  option if hosts want it.
- RFC-0004's crosshair-magnet exception is superseded by this ADR.
