const { test, expect } = require('@playwright/test');
const path = require('path');

const fixture = (f) => 'file://' + path.resolve(__dirname, 'fixture', f);

test('dynamicSizing cannot collapse a chart below minHeight', async ({ page }) => {
  await page.goto(fixture('gallery.html'));
  const h = await page.evaluate(
    () => document.getElementById('chart-dynamic').offsetHeight
  );
  expect(h).toBeGreaterThanOrEqual(500);
});

// Assert the chart matches its container, not merely that width > 0: a chart
// rendered inside a display:none pane reports a non-zero width from the
// dimensions htmlwidgets wrote at render time, so `width > 0` passes even when
// the canvas never measured anything. Only agreement with the revealed
// container distinguishes a correctly sized chart from a stale one.
test('a chart in an initially hidden tab is sized to its container on reveal', async ({
  page,
}) => {
  await page.goto(fixture('tabset.html'));

  // Establish the pane really was collapsed, or the test proves nothing.
  const hiddenW = await page.evaluate(
    () => document.getElementById('chart-tab').offsetWidth
  );
  expect(hiddenW).toBe(0);

  await page.click('a[href="#second-tab"]');
  const canvas = page.locator('#chart-tab canvas');
  await expect(canvas).toBeVisible();

  const plain = await page.evaluate(() => {
    const el = document.getElementById('chart-tab');
    return { container: el.offsetWidth, chart: el.gsmChart.width };
  });
  expect(plain.container).toBeGreaterThan(0);
  expect(plain.chart).toBe(plain.container);
});

// facetBars builds its own grid of sub-charts and sizes them from the container,
// so it is the shape most exposed to measuring a collapsed pane.
test('faceted sub-charts in a hidden tab fill the row on reveal', async ({ page }) => {
  await page.goto(fixture('tabset.html'));
  await page.click('a[href="#second-tab"]');
  const facet = await page.evaluate(() => {
    const el = document.getElementById('chart-tab-facet');
    return {
      container: el.offsetWidth,
      widths: el.gsmFacet.charts.map((c) => c.width),
    };
  });
  expect(facet.widths).toHaveLength(2);
  facet.widths.forEach((w) => expect(w).toBeGreaterThan(0));
  // nCol = 2, so the two sub-charts share one row and should span the container.
  const total = facet.widths.reduce((a, b) => a + b, 0);
  expect(total).toBeGreaterThan(facet.container * 0.8);
});

test('a dynamicSizing chart in a hidden tab keeps its floor on reveal', async ({ page }) => {
  await page.goto(fixture('tabset.html'));
  await page.click('a[href="#second-tab"]');
  const dynamic = await page.evaluate(() => {
    const el = document.getElementById('chart-tab-dynamic');
    return { container: el.offsetWidth, chart: el.gsmChart.width, height: el.offsetHeight };
  });
  expect(dynamic.chart).toBe(dynamic.container);
  expect(dynamic.height).toBeGreaterThanOrEqual(500);
});
