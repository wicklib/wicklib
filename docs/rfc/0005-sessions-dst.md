# RFC-0005: Session-aware time scale

- Status: **Accepted** — compressed labels and explicit gaps implemented
- Date: 2026-10-27
- Depends on: RFC-0001 (accepted), RFC-0003 (accepted)

## 1. Context

Wicklib currently uses a continuous, index-based time scale. It is correct for crypto, where
bars exist continuously, but it compresses non-trading time for instruments such as equities,
futures, and FX.

The current `timezone` option only changes labels. It does not know weekends, exchange breaks,
holidays, or daylight-saving transitions. Compressing those gaps makes a daily chart look
continuous and makes session-boundary ticks misleading.

The time scale is also the foundation for drawings, indicators, panes, and the datafeed. A
session feature must extend that model without changing the default crypto behavior.

## 2. Goals

- Opt-in session-aware axes; continuous mode remains the default.
- Host-supplied calendars: no bundled exchange calendars.
- DST-correct local session boundaries using an IANA time zone.
- Configurable visual treatment of closed periods.
- Stable data-space anchors: drawings and indicators keep using UTC timestamps.
- No network, persistence, or exchange-specific code in core.

## 3. Non-goals

- Shipping a holiday database for every exchange.
- Fetching calendars or market data.
- Per-instrument session discovery.
- Changing bar validation or the datafeed contract.
- Order-flow, volume-profile, or trading-calendar UI.

## 4. Proposed model

```ts
export type SessionGapMode = "compress" | "show";

export interface SessionWindow {
  /** ISO weekday: 1 = Monday, 7 = Sunday. */
  openDay: number;
  /** Local time in the calendar timezone, HH:mm. */
  openTime: string;
  /** ISO weekday, exclusive. May wrap past midnight. */
  closeDay: number;
  /** Local time in the calendar timezone, HH:mm. */
  closeTime: string;
}

export interface TradingCalendar {
  /** IANA time zone, for example America/New_York. */
  timezone: string;
  /** Recurring weekly windows. */
  sessions: readonly SessionWindow[];
  /** Closed local dates in YYYY-MM-DD form. */
  holidays?: readonly string[];
}

export interface TimeScaleOptions {
  // Existing options...
  calendar?: TradingCalendar;
  gapMode?: SessionGapMode;
  /** Width of a shown closed period in CSS pixels. Defaults to 12. */
  gapWidth?: number;
}
```

- `calendar` is absent by default: behavior is unchanged.
- `gapMode: "compress"` keeps the current index layout but uses session-aware labels.
- `gapMode: "show"` inserts a fixed-width virtual gap for each closed period.
- Hosts own holiday lists and instrument-to-calendar mapping.

## 5. Time conversion

- Bars and drawings remain UTC milliseconds.
- Local times are resolved with `Intl.DateTimeFormat` and the calendar's IANA zone.
- DST rules:
  - Ambiguous local times choose the earlier instant.
  - Nonexistent local times move forward to the first valid instant.
  - Session boundaries are computed in UTC before layout.
- Calendar evaluation is deterministic for a given ICU time-zone database. No ambient clock
  is used.

## 6. Layout and rendering

- The time scale becomes a sequence of session segments. Each segment contains bar slots;
  `gapMode: "show"` adds a virtual non-data segment between sessions.
- `timeToX`, `xToIndex`, visible ranges, panning, and zooming must all use the same segment
  mapping. No adapter may bypass it.
- Bars never fill closed periods; the core does not synthesize candles.
- Ticks favor local session opens, closes, midnight, and day boundaries. Closed-period
  labels are omitted.
- Drawings remain anchored to UTC `{ time, price }`; their x position uses the session mapping.
- Price autoscale only considers bars in the visible session segments.
- When `gapMode: "compress"`, the current index layout is retained and only labels change.
  This is the lower-risk first implementation.

## 7. Interactions

- Pan, wheel, trackpad, keyboard, and pinch continue through the shared time-scale methods.
- Crosshair time remains UTC; the host formats it with the chart timezone.
- Keyboard `Home` fits the same visible content as before, constrained by
  `maxVisibleBars`.
- No new public pan/zoom API is required.

## 8. Datafeed

The datafeed contract does not change. Hosts request data by UTC time range and must not
request synthetic bars for closed periods. Bars that fall outside a declared session are
rendered as supplied; validation does not reinterpret them.

## 9. Migration

- Additive only.
- Existing charts, tests, and snapshots must remain unchanged when `calendar` is absent.
- The internal time-scale policy seam is introduced before any session rendering. No
  session-specific branches in the renderer or series code.
- `gapMode: "show"` can ship after compressed mode and its tests are stable.

## 10. Open questions and recommendations

1. **Compress or show gaps first?** Recommend compress first: it validates calendars and
   DST with much less layout risk. Show gaps second.
2. **Where do holidays live?** Host-supplied. Bundled exchange calendars would require
   ongoing data maintenance and licensing review.
3. **Overnight sessions?** Model as one window that wraps past midnight. Do not invent two
   windows unless the venue has a real break.
4. **DST overlap ambiguity?** Use the earlier instant, documented and tested.
5. **Should session gaps count toward `maxVisibleBars`?** No. That option caps price bars,
   not virtual closed-period segments.

## 11. Implementation notes

The first compressed-mode slice is implemented:

- `TradingCalendar` and `SessionWindow` are public.
- Calendar times resolve through IANA time zones, including DST transitions.
- Intraday views up to two days skip closed-period ticks and add session open/close ticks.
- Labels and crosshair times use the calendar timezone.
- `gapMode: "show"` inserts fixed-width gaps for closed sessions and keeps pan, zoom, fit,
  drawings, and aggregated candles aligned to the same layout mapping.
- Wider views keep date-level ticks. Holidays UI and bundled exchange calendars remain out of
  scope.

## 12. Acceptance criteria

- Continuous charts are byte-for-byte unaffected when no calendar is supplied.
- A New York equity calendar produces correct session opens and closes across the spring and
  autumn DST transitions.
- Compressed mode labels session boundaries correctly.
- Show-gaps mode keeps pan, zoom, hit-testing, drawings, and autoscale coherent.
- No core imports, network calls, or wall-clock reads are introduced.
- Tests cover DST gaps/overlaps, holidays, overnight windows, and multi-pane charts.
