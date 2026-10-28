import { expect, test } from "@playwright/test";
import type { ChartApi } from "@wicklib/core";

declare global {
  interface Window {
    __wicklibChart?: ChartApi;
  }
}

test("zooms the timeline by dragging the time axis", async ({ page }) => {
  await page.goto("/?test");
  await page.waitForFunction(() => window.__wicklibReady === true);

  const box = await page.locator("#chart").boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }

  const before = await page.evaluate(() => {
    const range = window.__wicklibChart?.timeScale().getVisibleRange();
    return range ? range.to - range.from : 0;
  });

  const y = box.y + box.height - 10;
  const startX = box.x + box.width * 0.4;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + 120, y, { steps: 5 });
  await page.mouse.up();

  const after = await page.evaluate(() => {
    const range = window.__wicklibChart?.timeScale().getVisibleRange();
    return range ? range.to - range.from : 0;
  });
  expect(after).toBeLessThan(before);
  expect(after).toBeGreaterThan(0);
});

test("switches themes without recreating or breaking the chart", async ({ page }) => {
  await page.goto("/?test");
  await page.waitForFunction(() => window.__wicklibReady === true);

  const backgroundColor = () =>
    page.evaluate(() => {
      const chart = window.__wicklibChart;
      if (!chart) {
        return null;
      }
      const canvas = chart.takeScreenshot();
      const pixel = canvas.getContext("2d")?.getImageData(2, 2, 1, 1).data;
      return pixel ? Array.from(pixel) : null;
    });

  const dark = await backgroundColor();
  expect(dark?.[0]).toBeLessThan(50);

  await page.locator("#theme").click();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "light");

  const light = await backgroundColor();
  expect(light?.[0]).toBeGreaterThan(200);

  const range = await page.evaluate(() => {
    const value = window.__wicklibChart?.timeScale().getVisibleRange();
    return value ? value.to - value.from : 0;
  });
  expect(range).toBeGreaterThan(0);

  await page.locator("#theme").click();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
});
