# @wicklib/script

WickScript — TypeScript for charts.

**Status: API v1 authoring + compiler + worker runtime.** `defineScript`, typed inputs/plots,
source-faithful TypeScript transpilation, import/sandbox-boundary validation, a QuickJS
worker runtime with limits, and replay/stream execution are implemented. Free `ta.*`
functions and the editor remain.

Scripts are plain TypeScript against a fixed API. Wicklib does not invent syntax and does
not fork TypeScript.

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

Replay and streaming use the same per-bar state path.

Read, in order:

1. [`PLAN.md`](./PLAN.md) — the normative plan.
2. [`docs/spec.md`](./docs/spec.md) — the normative language and runtime spec.
3. [`docs/adr/`](./docs/adr/) — decisions that require a new ADR to change.

## License

Apache-2.0.
