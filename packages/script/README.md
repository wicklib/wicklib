# @wicklib/script

WickScript — TypeScript for charts.

**Status: API v1 authoring + compiler + sandbox core.** `defineScript`, typed inputs/plots,
source-faithful TypeScript transpilation, import/sandbox-boundary validation, a QuickJS
executor with limits, and a transport-independent worker protocol are implemented. The Web
Worker transport, replay/stream scheduler, and editor remain.

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

Read, in order:

1. [`PLAN.md`](./PLAN.md) — the normative plan.
2. [`docs/spec.md`](./docs/spec.md) — the normative language and runtime spec.
3. [`docs/adr/`](./docs/adr/) — decisions that require a new ADR to change.

## License

Apache-2.0.
