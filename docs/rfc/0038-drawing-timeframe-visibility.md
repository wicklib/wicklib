# RFC-0038: Drawing timeframe visibility

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0037 (accepted)

## 1. API

`DrawingOptions.visibleIntervals?: readonly string[]` limits drawing rendering to listed chart
intervals. Omitted or empty means all intervals. `ChartOptions.interval` declares the current chart
interval; otherwise the primary datafeed interval or inferred bar step is used.

## 2. Behavior

- Timeframe-hidden drawings remain in the drawing document and serialization output.
- They do not render, hit-test, hover, or become selected on non-matching intervals.
- Select All with `visibleOnly: true` skips explicit hidden and timeframe-hidden drawings.
- `visibleIntervals` is normalized, deduplicated, and persisted.
- Runtime option updates and interval changes apply immediately.
- Existing documents without the field remain visible everywhere.
- No object tree or visibility UI is added to core.

## 3. Acceptance criteria

- Empty/omitted intervals render everywhere.
- Single and multi interval lists match exactly.
- Hidden-by-timeframe drawings are not hit-tested or selected.
- Select All visible-only excludes them.
- Serialization round trips and runtime updates preserve the field.
