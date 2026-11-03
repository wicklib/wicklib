---
"@wicklib/core": minor
---

Add instrument-specific price formatting through `priceScale.priceFormat.precision` and
`priceScale.priceFormat.minMove`. Price, time, pane, series, and indicator APIs now expose
resolved options and datafeed identity for host-owned workspace persistence. Datafeeds can
select `auto`, `fit`, or `preserve` initial views when loading or switching symbols.
Logarithmic price scales now support transforms, auto-ranging, ticks, and formatting.
