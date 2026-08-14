const { test, expect } = require('@playwright/test');
const path = require('path');

const GALLERY = 'file://' + path.resolve(__dirname, 'fixture', 'gallery.html');

// Spec R1.1 proof: the relocated Widget_BarChart must render end-to-end with every
// dependency (binding JS, YAML-declared control libs, gsmViz bundle + main.css)
// resolved from gsm.vizr's installed tree. A missing dependency surfaces as a
// pageerror or a chartless container, not as an R-side failure.
test('relocated Widget_BarChart renders without page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(GALLERY);
  await expect(page.locator('#page-legacy-barchart canvas')).toBeVisible();
  const gsmVizLoaded = await page.evaluate(() => typeof window.gsmViz !== 'undefined');
  expect(gsmVizLoaded).toBe(true);
  expect(errors).toEqual([]);
});
