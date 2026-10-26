# ADR-0005: Free runtime, paid built-ins

- Status: Accepted
- Date: 2026-10-26

## Context

The script runtime is the adoption engine: if authoring is restricted, nobody writes
scripts and the ecosystem never forms. The commercial value is in analytics that are hard
to clone and in infrastructure that needs a backend.

## Decision

- `@wicklib/script` and `@wicklib/script-editor` are Apache-2.0 and free.
- Free `ta.*` functions ship in the script package.
- Premium `ta.*` functions are registered by `@wicklib/pro` through
  `registerScriptFunction`, with `meta.license = "pro"`.
- Strategy/backtest, alerts, and server-side execution are paid.
- Script storage, sharing, and teams belong to the host application, not the library.

## Consequences

- The script package never depends on pro; the dependency arrow points inward.
- A license check is required at function invocation and at feature use.
- The free runtime is inspectable; the moat is the premium analytics and the platform.
- Moving a function between tiers is a metadata change, not a refactor.

## Alternatives rejected

- Paid runtime: kills adoption and pushes users to competitors.
- Free everything: no revenue path and no funding for the hard analytics.
- Closed-source runtime with an open API: source ships with the package anyway; the
  restriction only discourages contributions.
