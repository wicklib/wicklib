# WickScript — Normative Spec

Version: API v1
Status: normative. Authoring ergonomics follow ADR-0006.

The key words MUST, MUST NOT, SHOULD, and MAY are used as in RFC 2119.

## 1. Language

1. A script MUST be valid TypeScript that transpiles with types stripped.
2. A script MUST NOT rely on type information at runtime.
3. A script MUST contain exactly one entry module. Relative imports MUST be rejected.
4. The only permitted import source MUST be the virtual module `@wicklib/script`.
5. A script MUST declare its API version in a header comment: `// @wicklib/api 1`.
6. `any`, `eval`, `Function`, and dynamic `import()` MUST be rejected at compile time.

## 2. Execution

1. The runtime MUST invoke the entry function once per bar, in ascending bar order.
2. Replay and streaming MUST use the same entry function and the same code path.
3. The runtime MUST NOT execute the entry for a bar twice during replay.
4. A streaming update for the current bar MUST follow the declared revision semantics.
5. `dispose()` MUST release every buffer, timer, and worker owned by the script.
6. Execution order across scripts MUST NOT be observable.

## 3. Determinism

1. Identical source, inputs, and bars MUST produce identical outputs.
2. A script MUST NOT access wall-clock time.
3. A script MUST NOT access unseeded randomness.
4. A script MUST NOT perform I/O of any kind.
5. Floating-point arithmetic MUST follow IEEE-754 double semantics.

## 3A. Authoring shape

A script MUST default-export a `defineScript` definition.

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

- Inputs MUST be declared as typed descriptors with defaults.
- Plot ids MUST be stable and unique within the script.
- `onBar` MUST be synchronous and called once per bar.
- Module-level mutable state MUST NOT be used; use `ctx.state`.
- Plot ids are inferred from the declared `plots` array.

## 4. Context

The context object MUST expose:

- `bar` — read-only OHLCV for the current bar.
- `index` — zero-based bar index within the replay.
- `inputs` — resolved, read-only user inputs.
- `state` — persistent per-script state, cleared on `dispose`.
- `plot(seriesId, value)` — emits one value per bar per series.
- `alert(message)` — emits at most the configured maximum per bar.

`plot` and `alert` MUST be no-ops after the script is disposed.

## 5. Inputs

1. Inputs MUST be declared before execution.
2. Inputs MUST be type-checked against their declared type.
3. Inputs MUST be immutable for the lifetime of a run.

## 6. Output

1. Each `plot` series MUST produce exactly one value per replayed bar, or `null`.
2. `ScriptResult.plots` MUST be ordered by bar.
3. Runtime errors MUST include the failing bar index and MUST halt the run.
4. Compile errors MUST be reported before any bar executes.

## 7. Resource limits

The runtime MUST enforce:

- a maximum instruction count per bar,
- a maximum wall-clock time per run,
- a maximum memory allocation per instance,
- a maximum number of plot series and alerts,
- a maximum string length.

Exceeding a limit MUST produce a typed error, not a crash of the host.

## 8. Isolation

1. Scripts MUST execute off the main thread.
2. Scripts MUST NOT access DOM, network, storage, or timers.
3. Scripts MUST NOT import npm packages.
4. The host MUST expose only the documented API to the script realm.

## 9. Compatibility

1. `WICKSCRIPT_API_VERSION` MUST identify the current API.
2. The runtime MUST support the current major and the previous major.
3. Removing or changing behavior MUST require a major API version bump.
4. A script compiled for an unsupported version MUST fail with a typed error.
