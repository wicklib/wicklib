import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __wicklibReady?: boolean;
    __wicklibBench?: {
      frames: number;
      medianMs: number;
      p95Ms: number;
      fps: number;
    };
  }
}

test("static 100k candlestick plot", async ({ page }) => {
  await page.goto("/?test");
  await page.waitForFunction(() => window.__wicklibReady === true);
  await page.waitForTimeout(150);

  const box = await page.locator("#chart").boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }

  await expect(page).toHaveScreenshot("static-plot.png", {
    clip: {
      x: Math.floor(box.x + 12),
      y: Math.floor(box.y + 64),
      width: Math.floor(box.width - 80),
      height: Math.floor(box.height - 110),
    },
    animations: "disabled",
  });
});

test("indicator panes", async ({ page }) => {
  await page.goto("/?test&indicators");
  await page.waitForFunction(() => window.__wicklibReady === true);
  await page.waitForTimeout(150);

  const box = await page.locator("#chart").boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }

  await expect(page).toHaveScreenshot("indicator-panes.png", {
    clip: {
      x: Math.floor(box.x + 12),
      y: Math.floor(box.y + 64),
      width: Math.floor(box.width - 80),
      height: Math.floor(box.height - 110),
    },
    animations: "disabled",
  });
});

test("drawing tools", async ({ page }) => {
  await page.goto("/?test&drawings");
  await page.waitForFunction(() => window.__wicklibReady === true);
  await page.waitForTimeout(150);

  const box = await page.locator("#chart").boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }

  await expect(page).toHaveScreenshot("drawing-tools.png", {
    clip: {
      x: Math.floor(box.x + 12),
      y: Math.floor(box.y + 64),
      width: Math.floor(box.width - 80),
      height: Math.floor(box.height - 110),
    },
    animations: "disabled",
  });
});

test("derives a timeframe from 1m bars", async ({ page }) => {
  await page.goto("/?test&timeframe=15m");
  await page.waitForFunction(() => window.__wicklibReady === true);

  await expect(page.locator("#summary")).toContainText("15m");
  await expect(page.locator("#summary")).toContainText("6,667 bars");

  await page.selectOption("#timeframe", "5m");
  await expect(page.locator("#summary")).toContainText("5m");
  await expect(page.locator("#summary")).toContainText("20,000 bars");
});

test("session calendar", async ({ page }) => {
  await page.goto("/?test&sessions");
  await page.waitForFunction(() => window.__wicklibReady === true);
  await page.waitForTimeout(150);

  const box = await page.locator("#chart").boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }

  await expect(page.locator("#summary")).toContainText("US equities RTH");
  await expect(page).toHaveScreenshot("session-hours.png", {
    clip: {
      x: Math.floor(box.x + 12),
      y: Math.floor(box.y + 64),
      width: Math.floor(box.width - 80),
      height: Math.floor(box.height - 110),
    },
    animations: "disabled",
  });
});

test("100k bar pan benchmark", async ({ page }) => {
  await page.goto("/?bench");
  await page.waitForFunction(() => Boolean(window.__wicklibBench), null, {
    timeout: 45_000,
  });

  const result = await page.evaluate(() => window.__wicklibBench);
  console.log("WICKLIB_BENCH", result);

  expect(result?.frames).toBeGreaterThan(100);
  expect(result?.p95Ms).toBeLessThan(50);
});
