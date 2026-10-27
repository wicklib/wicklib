# AGENTS.md

Instructions for AI agents and maintainers working in this repository.

## Mission

Wicklib is a professional, open-core charting engine for the web. The free engine is
Apache-2.0. The commercial add-on lives in a separate private repository and consumes this
package through its published entrypoint only.

Read `PLAN.md` before starting work. Read `packages/script/PLAN.md` and its ADRs before
touching anything script-related.

## The non-negotiable standard

**Build the durable version first.** Never ship a placeholder architecture that later forces
a rewrite of the public API, the data model, the renderer boundary, or the package
boundaries.

A simple feature is allowed only when it is implemented **on top of** the production
pipeline — scales → renderer → series → interactions — never as a shortcut around it.
"Basic" means fewer features, not a disposable foundation. If a feature cannot be added
without turning the code upside down later, do not add it yet.

## Hard rules

- `@wicklib/core` has zero runtime dependencies and never imports siblings.
- Plugins declare `@wicklib/core` as a peer dependency. Exactly one registry instance.
- The `exports` map is the contract. No deep imports, no internal types in public API.
- No network, persistence, accounts, databases, or server code in library packages.
- Public API changes go through the API Extractor report as a reviewed diff.
- TypeScript strict. No `any` in public types. TSDoc on every public symbol.
- Library logic is deterministic: no ambient wall clock, no unseeded randomness.
- Every bug fix gets a regression test. Every rendering feature gets a visual or golden test.
- Every dependency needs a reason and a license check. Prefer none.
- Never weaken a boundary check to make a build pass.

## Workflow

1. Significant work starts with a plan update, RFC, or ADR.
2. Implement in small vertical slices that keep `main` releasable.
3. Add tests in the same change.
4. Run `pnpm checks` and `pnpm format:check`.
5. Update the API report deliberately (`pnpm build && pnpm api`).
6. Commit with Conventional Commits and DCO sign-off (`git commit -s`).

Do not mark work done because it compiles. It is done when it is tested, documented, and the
checks are green.

## Commands

```sh
pnpm install
pnpm dev            # playground (added in Phase 2)
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm depcruise
pnpm api
pnpm checks
pnpm format:check
pnpm pack:core
```

## Layout

- `packages/core` — renderer, scales, series, panes, drawings, extension registry.
- `packages/indicators` — free catalog (deferred; authored in WickTS when it starts).
- `packages/react` — thin wrapper.
- `packages/script` — WickScript contract, spec, ADRs (implementation deferred).
- `packages/script-editor` — Monaco integration (deferred).
- `packages/wicklib` — umbrella meta-package.
- `apps/playground` — private local dev harness (Phase 2). Never published.
- `docs/rfc` — design proposals that must be accepted before implementation.

## Definition of done

- Behavior covered by tests; rendering covered visually.
- Public API documented and the report updated on purpose.
- Boundary and dependency checks still pass.
- No hidden global state, no leaks, `destroy()` releases everything.
- The change can be reverted without leaving the architecture in a worse state.
