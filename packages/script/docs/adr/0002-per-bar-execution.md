# ADR-0002: Per-bar incremental execution

- Status: Accepted
- Date: 2026-10-26

## Context

Indicator code can process data in two ways: batch (receive arrays, return arrays) or
per-bar (called once per bar with state carried forward). Live alerts, streaming updates,
and deterministic replay all depend on this choice.

## Decision

The runtime executes the entry function once per bar, in ascending order. History is
replayed bar-by-bar, then realtime bars flow through the same function. Replay and live
use one code path.

## Consequences

- Backtest and live behavior cannot diverge, because they are the same path.
- State and lookback buffers are first-class runtime concerns.
- Per-bar interpretation is slower than vectorized math; hot built-ins are implemented
  natively and vectorized where possible.
- Streaming bar revisions (partial bar updates) need explicit semantics.

## Alternatives rejected

- Batch/vectorized only: simpler to implement, but requires a second path for live data,
  which produces the classic "backtest works, live does not" class of bugs.
- Hybrid with separate modes: two paths to keep in sync, and two sets of tests.
