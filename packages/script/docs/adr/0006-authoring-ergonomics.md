# ADR-0006: Authoring ergonomics

- Status: Proposed — must be accepted before implementation starts
- Date: 2026-10-26

## Context

The runtime contract (`compile`, `run(context)`, replay, stream) is frozen. The user-facing
authoring shape is not: how a script declares its entry, inputs, plots, and state.

## Options

1. **Default export function**
   `export default function script(ctx: ScriptContext) { ... }`
   Simple, familiar, zero runtime API. Inputs declared by a separate `meta` export.

2. **`defineScript` helper**
   `export default defineScript({ inputs, onBar })`
   Explicit metadata, better typing, easier documentation. Adds one import.

3. **Two-phase hooks**
   `init(ctx)` and `onBar(ctx)`.
   Clearer for expensive setup, but more surface and more ways to get state wrong.

## Constraints

- Must be one code path for replay and streaming.
- Must support typed inputs and stable output series identity.
- Must remain valid plain TypeScript with no custom syntax.
- Must be ergonomic for AI authoring: one obvious shape, no cleverness.
- Must not expose runtime internals or allow module-level mutable state.

## Decision

Deferred. Accept this ADR before writing the transpiler or runtime. Whichever shape is
chosen becomes part of API version 1 and cannot change without a major bump.
