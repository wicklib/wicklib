# ADR-0006: Authoring ergonomics

- Status: Accepted
- Date: 2026-10-27

## Context

The runtime contract (`compile`, `run(context)`, replay, stream) is frozen. The user-facing
authoring shape is not: how a script declares its entry, inputs, plots, and state.

## Options

1. **Default export function**
   `export default function script(ctx: ScriptContext) { ... }`
   Simple, familiar, zero runtime API. Inputs declared by a separate `meta` export.

2. **`defineScript` helper**
   `export default defineScript({ inputs, plots, onBar })`
   Explicit metadata, better typing, easier documentation. Adds one import.

3. **Two-phase hooks**
   `init(ctx)` and `onBar(ctx)`.
   Clearer for expensive setup, but more surface and more ways to get state wrong.

## Decision

Use the `defineScript` helper.

```ts
import { defineScript } from "@wicklib/script";

export default defineScript({
  inputs: {
    period: { type: "number", title: "Period", defaultValue: 20, min: 1 },
  },
  plots: [{ id: "sma", title: "SMA", type: "line" }],
  onBar(ctx) {
    ctx.plot("sma", ctx.bar.close);
  },
});
```

The default export is the script definition. `onBar` is the only execution hook. Inputs and
plot ids are inferred from the definition, so invalid ids fail at compile time.

Module-level mutable state is not a supported pattern; per-run state lives in `ctx.state`.

## Consequences

- One obvious authoring shape for humans, editors, and AI tools.
- Input and plot metadata are colocated with behavior and typed.
- The runtime and editor consume the same definition type.
- The API requires one import from the virtual `@wicklib/script` module.
- The shape is part of API version 1; changing it requires a major version.
