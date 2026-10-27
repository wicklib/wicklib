import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.03,
      threshold: 0.3,
    },
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1200, height: 800 },
    colorScheme: "dark",
    deviceScaleFactor: 1,
  },
  // One baseline shared across platforms; the clip excludes text so only the canvas
  // rasterization differs.
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  webServer: {
    command: "pnpm build && pnpm preview --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
