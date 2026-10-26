# Contributing to Wicklib

## Developer Certificate of Origin

Every commit must be signed off:

```sh
git commit -s -m "feat(core): add price scale"
```

The sign-off certifies the Developer Certificate of Origin 1.1
(https://developercertificate.org). No CLA is required.

## Setup

```sh
corepack enable
pnpm install
pnpm checks
```

Requires Node 24 and pnpm 10.

## Before opening a pull request

- `pnpm checks` passes locally.
- The API report in `packages/core/etc` is updated and reviewed when the public surface
  changes. Run `pnpm api` after `pnpm build`.
- New public API is documented with TSDoc and carries no `any`.
- One logical change per pull request.

## Commit messages

Conventional Commits: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `build`, `ci`.
Scope is the package name without the prefix, for example `feat(core): ...`.

## Boundaries

`@wicklib/core` must never import `indicators`, `react`, `script`, `script-editor`, or
`wicklib`. Plugins register into core through the extension registry. CI enforces this.

## Security

Do not open public issues for security problems. See [SECURITY.md](./SECURITY.md).
