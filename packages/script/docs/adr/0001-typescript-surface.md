# ADR-0001: TypeScript is the script surface

- Status: Accepted
- Date: 2026-10-26

## Context

Wicklib needs a scripting surface for user-authored indicators. The two realistic families
are a domain-specific language (Pine-like) and an existing general-purpose language with a
fixed API.

## Decision

WickScript is TypeScript against a fixed, typed API. Scripts are plain `.ts` files with no
custom syntax. The API is shipped as a generated `.d.ts` and is the single source of truth
for the editor, diagnostics, documentation, and AI authoring.

## Consequences

- LLMs author scripts accurately because TypeScript is their strongest domain.
- Monaco provides autocomplete and type checking without custom tooling.
- Built-in indicators can later be authored in the same API.
- The runtime must strip types; type information is not available at runtime.
- JavaScript's larger attack surface must be contained by the sandbox (ADR-0003).

## Alternatives rejected

- Pine-like DSL: powerful, but 6–18 months of compiler work before parity, plus a custom
  editor, docs, and migration story.
- JavaScript with JSDoc: workable, but weaker typing and worse AI reliability.
