# Playground

Private local dev harness for `@wicklib/core`.

```sh
pnpm dev        # from the repo root
```

Vite aliases `@wicklib/core` to `packages/core/src/index.ts`, so edits hot-reload without
a rebuild. The published package and the site still resolve through `dist`.

Never published. Not part of the Changesets group.

## Controls

- Dataset size: 5k, 25k, 100k synthetic 1m bars.
- Regenerate: new deterministic dataset (seed increments).
- Fit: reset the time scale.
- Theme: dark/light chart options.
- FPS meter and crosshair OHLC readout.
