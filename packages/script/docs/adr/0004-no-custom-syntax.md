# ADR-0004: Do not invent a new syntax

- Status: Accepted
- Date: 2026-10-26

## Context

A custom language offers the best domain ergonomics, but it requires a parser, type checker,
language server, formatter, documentation, migration policy, and years of ecosystem
building. The Wicklib team is small.

## Decision

No new grammar. "WickScript" names the API and execution model, not a syntax. A future DSL,
if ever built, must compile down to the same runtime contract and the same API types.

## Consequences

- The door stays open for a DSL later, because the runtime contract is the target.
- Tooling is inherited: Monaco, ESLint, Prettier, and TypeScript's language service.
- Domain ergonomics must be delivered through the API design (helpers, series semantics),
  not through keywords.
- Some Pine idioms will not map one-to-one, and the documentation must say so.

## Alternatives rejected

- Forking TypeScript: multi-year maintenance burden, permanent upgrade tax.
- A Pine-compatible parser: high effort, legal and compatibility risk, and it still needs
  an editor and a runtime.
