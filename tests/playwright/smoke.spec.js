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

// bars() and facet_bars() share one binding; the presence of the facet payload
// slot is the only thing routing to facetBars. Assert on el.gsmFacet rather than
// a canvas count — the bars branch would also paint canvases, so a dispatch
// regression that silently rendered a single un-faceted chart would slip past.
test('facet_bars() dispatches to facetBars and builds one chart per facet', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(GALLERY);
  const facet = await page.evaluate(() => {
    const el = document.getElementById('chart-facet');
    return {
      hasFacet: !!el.gsmFacet,
      hasPlainChart: !!el.gsmChart,
      charts: el.gsmFacet ? el.gsmFacet.charts.length : 0,
      labels: el.gsmFacet ? el.gsmFacet.charts.map((c) => c.data.labels) : null,
    };
  });
  expect(facet.hasFacet).toBe(true);
  expect(facet.hasPlainChart).toBe(false);
  expect(facet.charts).toBe(2);
  expect(facet.labels).toEqual([
    ['S-001', 'S-002'],
    ['S-001', 'S-002'],
  ]);
  expect(errors).toEqual([]);
});
