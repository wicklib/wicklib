# RFC-0037: Visible-only Select All

- Status: **Accepted** — implemented
- Date: 2026-11-08
- Depends on: RFC-0013 (accepted)

## 1. API

`ChartApi.selectAllDrawings` accepts an optional `{ visibleOnly?: boolean }`. `visibleOnly`
defaults to true. Passing false preserves the previous all-drawings behavior.

## 2. Behavior

- Hidden drawings are excluded by default.
- Locked drawings remain selectable; lock still prevents movement and deletion.
- Hidden drawings remain excluded from pointer hit testing.
- Ctrl/Command+A uses visible-only selection by default.
- No host object tree or visibility UI is added to core.

## 3. Acceptance criteria

- No-argument calls select only visible drawings.
- `visibleOnly: false` selects hidden drawings as well.
- Locked visible drawings are selected.
- Existing visibility and locking behavior is unchanged.
