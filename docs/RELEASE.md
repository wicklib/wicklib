# Release procedure

Releases are manual and publish-only. A release workflow never versions packages.

## Before releasing

1. Start from a clean `main` with the version commit pushed.
2. Confirm CI is green, including visual tests and bundle budgets.
3. Review every package `CHANGELOG.md` and the selected version.
4. Confirm the npm `NPM_TOKEN` secret is valid and has access to `@wicklib` and `wicklib`.
5. Confirm no generated datasets, keys, build output, or local artifacts are staged.

## Prerelease line

The alpha line publishes under the `next` tag:

1. Enter prerelease mode once with `pnpm changeset pre enter next`.
2. Add changesets for user-visible changes.
3. Run `pnpm changeset version`.
4. Commit the version and changelog changes.
5. Push and run the **release** workflow from the Actions tab.
6. Verify the `next` dist-tag on every free package.

Use exact versions or `@next` in consuming applications. The default `latest` tag remains on
the old stable channel until a stable release.

## Stable release

A stable release is a deliberate API-stability decision, not a routing step.

1. Freeze new public API work.
2. Finish documentation and migration notes.
3. Exit prerelease mode with `pnpm changeset pre exit`.
4. Run `pnpm changeset version` and confirm the stable versions and peer ranges.
5. Run `pnpm checks`, `pnpm test:visual`, and `pnpm exec size-limit`.
6. Commit and push the version changes.
7. Run the **release** workflow.
8. Verify `latest` and `next` dist-tags, then install from a clean temporary project.

Never publish the same version twice. If a partial publish occurs, inspect which packages
already exist before bumping.

## Post-release verification

- `npm view <package> dist-tags` shows the expected tags.
- A clean install resolves the intended version from the registry.
- Core, React, script, and editor packages interoperate at the same release train.
- Documentation examples match the published API.
- Consumer applications can install without workspace links.

## Rollback

npm versions are immutable. Do not unpublish as a routine rollback. Publish a fixed patch,
move the dist-tag only when necessary, and document the issue in the changelog.

## Provenance and tokens

npm trusted publishing is configured, but the current GitHub OIDC subject format is not yet
accepted by npm ([npm/cli#9969](https://github.com/npm/cli/issues/9969)). Releases use a
granular `NPM_TOKEN` with provenance disabled. When npm accepts the subject format, remove
the token step, restore `publishConfig.provenance`, and add `id-token: write`.

## Pro

`@wicklib/pro` releases separately. Keep its `@wicklib/core` peer range compatible, verify
license tests, and version it only after the matching public core release is published.
