const { test, expect } = require('@playwright/test');
const path = require('path');

const GALLERY = 'file://' + path.resolve(__dirname, 'fixture', 'gallery.html');

test('gallery renders the basic chart without page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(GALLERY);
  const canvas = page.locator('#chart-basic canvas');
  await expect(canvas).toBeVisible();
  const hasChart = await page.evaluate(
    () => !!document.getElementById('chart-basic').gsmChart
  );
  expect(hasChart).toBe(true);
  expect(errors).toEqual([]);
});

// A one-level factor is the only shape where the R side can emit a scalar
// "order" and no R test can see the consequence: upstream resolveCategories()
// calls explicitOrder.filter(), which throws TypeError on a string, leaving a
// blank widget and a silent R call. Asserting on pageerror is the point of this
// test — the canvas check alone would pass against an empty chart.
test('single-level factors render instead of throwing on a scalar order', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(GALLERY);
  await expect(page.locator('#chart-singleton canvas')).toBeVisible();
  const labels = await page.evaluate(
    () => document.getElementById('chart-singleton').gsmChart.data.labels
  );
  expect(labels).toEqual(['S-001']);
  expect(errors).toEqual([]);
});
