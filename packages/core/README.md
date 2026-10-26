# @wicklib/core

The Wicklib core: rendering, scales, series, panes, drawings, datafeed contract, and the
extension registry.

**Phase 1:** the public API is frozen as typed stubs. Every function throws
`WICKLIB_NOT_IMPLEMENTED` until its implementation phase lands.

```ts
import { createChart } from "@wicklib/core";

const chart = createChart(document.getElementById("chart")!);
```

## Rules

- No runtime dependencies.
- Never imports sibling Wicklib packages. Extensions register inward.
- The public surface is gated by API Extractor; `etc/core.api.md` is reviewed like code.

## License

Apache-2.0.
