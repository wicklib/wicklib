# WickScript — Plan

Status: **normative**. Phase 4 is in progress: ADR-0006 is accepted, API v1 authoring is
frozen, and the transpiler with import/global rejection is implemented. A QuickJS worker
runtime with resource limits and replay/stream execution is implemented; the scheduler's
streaming revision semantics, free `ta.*`, and editor remain.
Changing a decision in this document requires a new ADR in `docs/adr/`.

## 1. What WickScript is

TypeScript for charts. Users write plain `.ts` against a small, fixed, typed API. There is
no new grammar and no fork of TypeScript. "wickts" is the format name, not a language.

Precedent: Microsoft Office Scripts is TypeScript for Excel. Figma, Obsidian, and
Cloudflare Workers all use TypeScript as their extension language.

## 2. Non-goals

- No custom syntax, no Pine Script clone, no compiler fork.
- No npm imports inside user scripts.
- No DOM, network, storage, timers, or ambient clock.
- No server-side execution in this package. Server execution is a platform service.
- No persistence, sharing, or marketplace. Those belong to the host application.

## 3. Surface

Authoring is TypeScript. The runtime executes a single entry function once per bar. The
exact authoring ergonomics (entry name, input declaration, helpers) are the subject of
ADR-0006, which must be written before implementation starts. The runtime contract below
is frozen now.

## 4. Execution model

Per-bar incremental, replayed then streamed, through one code path:

1. `compile(source)` → transpile types away → validate imports → `CompiledScript`.
2. `replay(history)` → call the entry once per bar, in order.
3. `stream(bar)` → call the same entry for each realtime bar.
4. `dispose()`.

Batch/vectorized execution is rejected: it cannot support live alerts without a second
code path, and dual paths produce backtest/live divergence.

## 5. Runtime architecture

```
Monaco / .ts source
      │  type stripping (no bundler)
      ▼
Web Worker  ──►  QuickJS (WASM)  ──►  entry(ctx)
      │                                  │
      └────────── host bindings ◄─────────┘
                  plot / alert / inputs / state
```

- Type stripping: TypeScript transpile or Sucrase. No type-directed runtime behavior.
- Isolation: QuickJS compiled to WASM inside a Web Worker. Not raw `eval` in a worker.
- The core is unaware of TypeScript, QuickJS, and workers. `@wicklib/script` registers a
  `ScriptRuntime` with the core through the extension registry.

## 6. Security and limits

- Imports restricted to the virtual `@wicklib/script` module.
- No `fetch`, `XMLHttpRequest`, `WebSocket`, `localStorage`, `indexedDB`, `document`.
- No `Date`, `performance.now`, `setTimeout`, `setInterval`, `queueMicrotask`.
- Seeded pseudo-randomness only, derived from the script id and bar time.
- Instruction interrupt and wall-clock interrupt enforced by QuickJS.
- Memory cap per script instance.
- Caps on plots, alerts, string length, and history lookback.
- Failure is explicit: compile error or runtime error with the bar index. No silent
  partial results.

## 7. Extension seam

`registerScriptFunction(name, impl, meta)` lets `@wicklib/pro` add premium `ta.*`
functions. The script package never depends on pro. License tier travels in `meta.license`.

## 8. Versioning

- Every script declares `@wicklib/api <n>`.
- The runtime supports the current major and the previous major.
- Deprecations are documented for at least one major before removal.
- `WICKSCRIPT_API_VERSION` is exported for tooling.

## 9. Editor and AI authoring

- Monaco ships the TypeScript language service, so autocomplete and diagnostics are free.
- A generated `.d.ts` is the single source of truth for both the editor and AI authoring.
- Ship a strict prompt pack: API surface, invariants, examples, and rejected patterns.
- A linter rejects unsupported imports and non-deterministic globals before execution.

## 10. Testing

- Golden scripts with committed expected plot arrays.
- Determinism tests: same input, same output, across runs and platforms.
- Fuzz tests for parser, transpiler, and runtime.
- Resource-limit tests: infinite loop, memory bomb, oversized output.
- Contract tests against `@wicklib/core` at minimum, latest, and next.

## 11. Performance

- Native built-ins are vectorized where hot; scripts stay per-bar.
- Workers keep the UI thread free.
- Incremental caches keyed by bar time.
- Optional WASM compilation of hot scripts is a later, measured optimization.
- Budget: scripting must not block the main thread for any duration, ever.

## 12. Licensing

- `@wicklib/script` and `@wicklib/script-editor`: Apache-2.0.
- Free `ta.*` functions ship in script.
- Premium `ta.*`, strategy/backtest, and alert runtime ship in `@wicklib/pro`.

## 13. Milestones (deferred)

1. [done] Spec freeze + ADR-0006 (authoring ergonomics).
2. [done] Transpiler + import and global validation.
3. [done] QuickJS worker host + message protocol.
4. [done] Per-bar scheduler with replay/stream parity. API v1 rejects in-place bar
   revisions; a future ADR can add a revision mode.
5. Per-bar scheduler with replay/stream parity.
6. Free `ta.*` set.
7. Editor + `.d.ts` generation.
8. Golden and fuzz test suites.
9. Pro premium functions and strategy engine.

## 14. Open questions

- Entry ergonomics: default export vs `defineScript`.
- Whether history lookback is explicit (`ctx.history`) or owned entirely by built-ins.
- Streaming revisions (partial bar updates) semantics.
- Multi-symbol and multi-timeframe scripts.
- Import whitelist expansion, if any.
