# @wicklib/script

WickScript — TypeScript for charts.

**Status: API v1 authoring + compiler + worker runtime.** `defineScript`, typed inputs/plots,
source-faithful TypeScript transpilation, import/sandbox-boundary validation, a QuickJS
worker runtime with limits, replay/stream execution, and the initial free `ta.*` set are
implemented. The editor remains.

Scripts are plain TypeScript against a fixed API. Wicklib does not invent syntax and does
not fork TypeScript.

```ts
import { defineScript, ta } from "@wicklib/script";

export default defineScript({
  inputs: {
    period: { type: "number", title: "Period", defaultValue: 20, min: 1 },
  },
  plots: [{ id: "sma", title: "SMA", type: "line" }],
  onBar(ctx) {
    ctx.plot("sma", ta.sma(ctx, "close", ctx.inputs.period));
  },
});
```

Host-side execution requires a worker built from the `@wicklib/script/worker` entry. With
Vite:

```ts
import ScriptWorker from "@wicklib/script/worker?worker";
import { createScriptWorkerRuntime } from "@wicklib/script";

const runtime = createScriptWorkerRuntime(new ScriptWorker());
const script = await runtime.compile(source, {
  inputs: { period: 50 },
});

const history = await script.replay(bars);
const next = await script.stream(nextBar);

await script.dispose();
runtime.dispose();
```

Free `ta.*` functions: `sma`, `ema`, `rsi`, `atr`, `highest`, `lowest`, `stdev`, `change`,
`roc`, `cum`, `vwma`, `tr`, `obv`, `linreg`, `barssince`, `crossover`, and `crossunder`.
They maintain deterministic per-session state. `barssince` requires an explicit stable key.

`validateScript(source)` runs the same header/import/global/syntax validation as compilation
without executing code. The editor uses it for inline diagnostics.

Replay and streaming use the same per-bar state path. API v1 streams closed bars only:
sending a bar whose time is not greater than the previous bar fails with
`REVISION_UNSUPPORTED`. To revise history, create a new session and replay it.

Read, in order:

1. [`PLAN.md`](./PLAN.md) — the normative plan.
2. [`docs/spec.md`](./docs/spec.md) — the normative language and runtime spec.
3. [`docs/adr/`](./docs/adr/) — decisions that require a new ADR to change.

## License

Apache-2.0.
