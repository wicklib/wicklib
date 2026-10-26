# Wicklib

Open-source charting engine for web applications. Canvas-first, framework-agnostic, and
designed for a clean separation between the free engine and the commercial add-on.

**Status: Phase 1 — foundation.** Rendering, indicators, and WickTS are not implemented yet.
The public API seams are frozen as typed stubs so the contract cannot drift.

## Packages

| Package                  | Status  | Description                                                             |
| ------------------------ | ------- | ----------------------------------------------------------------------- |
| `@wicklib/core`          | stubbed | Renderer, scales, series, panes, drawings, datafeed, extension registry |
| `@wicklib/indicators`    | planned | Built-in indicator catalog                                              |
| `@wicklib/react`         | stubbed | Thin React wrapper                                                      |
| `@wicklib/script`        | planned | WickScript (TypeScript for charts) runtime                              |
| `@wicklib/script-editor` | planned | Monaco integration                                                      |
| `wicklib`                | stubbed | Umbrella package: core + indicators                                     |

The commercial add-on (`@wicklib/pro`) lives in a separate private repository and consumes
`@wicklib/core` through its published entrypoint only.

## Development

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm depcruise
pnpm api
pnpm checks
```

`pnpm checks` runs the same sequence CI runs. Node 24 and pnpm 10 are required.

## Architecture rules

- `@wicklib/core` has zero runtime dependencies and imports nothing from sibling packages.
- Every plugin declares `@wicklib/core` as a peer dependency, so exactly one registry
  instance exists at runtime.
- All free packages share one fixed release train.
- Public API changes are gated by API Extractor; the report in `packages/core/etc` is
  reviewed like code.

See `packages/script/PLAN.md` and the ADRs in `packages/script/docs/adr/` for the scripting
design that Phase 1 deliberately freezes without implementing.

## License

Apache-2.0. See [LICENSE](./LICENSE).
