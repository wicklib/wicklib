import { expect, test } from "@playwright/test";
import type { ChartApi } from "@wicklib/core";

declare global {
  interface Window {
    __wicklibChart?: ChartApi;
    __wicklibSeriesReady?: boolean;
    __wicklibSeriesChart?: ChartApi;
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

test("focuses the chart on pointer down", async ({ page }) => {
  await page.goto("/?test");
  await page.waitForFunction(() => window.__wicklibReady === true);

  const box = await page.locator("#chart").boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.4);

  const focused = await page.evaluate(
    () => document.activeElement?.getAttribute("aria-label") === "Chart",
  );
  expect(focused).toBe(true);
});

test("creates an Elliott impulse drawing from the tool menu", async ({ page }) => {
  await page.goto("/?test");
  await page.waitForFunction(() => window.__wicklibReady === true);

  const box = await page.locator("#chart").boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }

  await page.selectOption("#drawing-tool", "elliott-impulse");
  for (const point of [
    { x: 160, y: 160 },
    { x: 220, y: 210 },
    { x: 300, y: 180 },
    { x: 380, y: 240 },
    { x: 470, y: 200 },
    { x: 560, y: 250 },
  ]) {
    await page.mouse.click(box.x + point.x, box.y + point.y);
  }

  const drawing = await page.evaluate(() => window.__wicklibChart?.serializeDrawings().drawings[0]);
  expect(drawing?.toolId).toBe("elliott-impulse");
  expect(drawing?.anchors).toHaveLength(6);
});

test("edits the selected drawing through the settings panel", async ({ page }) => {
  await page.goto("/?test&drawings");
  await page.waitForFunction(() => window.__wicklibReady === true);

  const id = await page.evaluate(() => {
    const drawing = window.__wicklibChart
      ?.serializeDrawings()
      .drawings.find((candidate) => candidate.toolId === "rectangle");
    if (drawing) {
      window.__wicklibChart?.selectDrawing(drawing.id);
    }
    return drawing?.id ?? null;
  });
  expect(id).not.toBeNull();
  await expect(page.locator("#drawing-settings")).toBeVisible();
  await expect(page.locator('[data-setting="fillColor"]')).toBeVisible();

  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>("#drawing-color");
    if (input) {
      input.value = "#112233";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  const color = await page.evaluate(
    () => window.__wicklibChart?.selectedDrawing()?.getOptions().color,
  );
  expect(color).toBe("#112233");
});

test("creates brush, path, and text drawings", async ({ page }) => {
  await page.goto("/?test");
  await page.waitForFunction(() => window.__wicklibReady === true);

  const box = await page.locator("#chart").boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }

  await page.selectOption("#drawing-tool", "brush");
  await page.mouse.move(box.x + 180, box.y + 160);
  await page.mouse.down();
  await page.mouse.move(box.x + 260, box.y + 220, { steps: 8 });
  await page.mouse.move(box.x + 340, box.y + 180, { steps: 8 });
  await page.mouse.up();

  await page.selectOption("#drawing-tool", "path");
  await page.mouse.click(box.x + 200, box.y + 260);
  await page.mouse.click(box.x + 300, box.y + 300);
  await page.mouse.click(box.x + 400, box.y + 260);
  await page.keyboard.press("Enter");

  await page.selectOption("#drawing-tool", "text");
  await page.mouse.click(box.x + 450, box.y + 180);

  const drawings = await page.evaluate(
    () => window.__wicklibChart?.serializeDrawings().drawings ?? [],
  );
  expect(drawings.find((drawing) => drawing.toolId === "brush")?.anchors.length).toBeGreaterThan(2);
  expect(drawings.find((drawing) => drawing.toolId === "path")?.anchors).toHaveLength(3);
  expect(drawings.find((drawing) => drawing.toolId === "text")?.options.text).toBe("Text");
  await expect(page.locator('[data-setting="text"]')).toBeVisible();
  await expect(page.locator('[data-setting="fontSize"]')).toBeVisible();
  await expect(page.locator('[data-setting="lineWidth"]')).toBeHidden();
});

test("selects and deletes multiple drawings with a modifier marquee", async ({ page }) => {
  await page.goto("/?test");
  await page.waitForFunction(() => window.__wicklibReady === true);

  const box = await page.locator("#chart").boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }

  for (const offset of [200, 400]) {
    await page.selectOption("#drawing-tool", "vertical-line");
    await page.mouse.click(box.x + offset, box.y + 200);
  }
  const count = () =>
    page.evaluate(() => window.__wicklibChart?.serializeDrawings().drawings.length ?? 0);
  expect(await count()).toBe(2);

  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.down(modifier);
  await page.mouse.move(box.x + 150, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 450, box.y + 320, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up(modifier);

  const selected = await page.evaluate(() => window.__wicklibChart?.selectedDrawings().length ?? 0);
  expect(selected).toBe(2);

  await page.keyboard.press("Delete");
  expect(await count()).toBe(0);
});

test("removes selected drawings with Delete and Backspace", async ({ page }) => {
  await page.goto("/?test&drawings");
  await page.waitForFunction(() => window.__wicklibReady === true);

  const box = await page.locator("#chart").boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.4);

  const count = () =>
    page.evaluate(() => window.__wicklibChart?.serializeDrawings().drawings.length ?? 0);
  const before = await count();
  expect(before).toBeGreaterThan(1);

  await page.evaluate(() => {
    const chart = window.__wicklibChart;
    const first = chart?.serializeDrawings().drawings[0];
    if (chart && first) {
      chart.selectDrawing(first.id);
    }
  });
  await page.keyboard.press("Delete");
  expect(await count()).toBe(before - 1);

  await page.evaluate(() => {
    const chart = window.__wicklibChart;
    const first = chart?.serializeDrawings().drawings[0];
    if (chart && first) {
      chart.selectDrawing(first.id);
    }
  });
  await page.keyboard.press("Backspace");
  expect(await count()).toBe(before - 2);
});

test("renders the line, area, histogram, price-line, and marker demo", async ({ page }) => {
  await page.goto("/series.html?test");
  await page.waitForFunction(() => window.__wicklibSeriesReady === true);

  const screenshot = await page.evaluate(() => {
    const canvas = window.__wicklibSeriesChart?.takeScreenshot();
    return canvas
      ? {
          width: canvas.width,
          height: canvas.height,
          dataUrl: canvas.toDataURL("image/png").length,
        }
      : null;
  });
  expect(screenshot?.width).toBeGreaterThan(0);
  expect(screenshot?.height).toBeGreaterThan(0);
  expect(screenshot?.dataUrl).toBeGreaterThan(1000);

  await page.locator("#theme").click();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("#summary")).toContainText("price lines + markers");
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
