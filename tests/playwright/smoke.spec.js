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
