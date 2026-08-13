const { test, expect } = require('@playwright/test');
const path = require('path');

const GALLERY = 'file://' + path.resolve(__dirname, 'fixture', 'gallery.html');

// The R side ships hook bodies as strings plus the dot-paths they belong at, so
// nothing here is observable from R: a formatter that stayed a string produces
// no error, just a tooltip rendering gsm.viz's default instead of the caller's.
test('js_hook slots are revived to live functions on known slots only', async ({ page }) => {
  await page.goto(GALLERY);
  const type = await page.evaluate(() => {
    const ch = document.getElementById('chart-hooks').gsmChart;
    return typeof ch.data._spec_.tooltip.formatter;
  });
  expect(type).toBe('function');
});

// typeof alone would pass on a function that throws or closes over nothing;
// calling it is what proves the body survived serialization intact.
test('a revived hook is callable and returns what the R-side body says', async ({ page }) => {
  await page.goto(GALLERY);
  const out = await page.evaluate(() => {
    const ch = document.getElementById('chart-hooks').gsmChart;
    return ch.data._spec_.tooltip.formatter(42, {}, {});
  });
  expect(out).toBe('Subjects: 42');
});

// Revival is driven by the jsHooks path list, not by "looks like a function
// body". A chart that declared no hooks must come through with none.
// Only formatter slots are checked: the binding installs its own
// callbacks.onClick/onSelect on every chart for the gsm-viz-select contract,
// so those being functions is the event glue working, not stray revival.
test('charts without hooks gain no revived formatter slots', async ({ page }) => {
  await page.goto(GALLERY);
  const hookish = await page.evaluate(() => {
    const spec = document.getElementById('chart-basic').gsmChart.data._spec_;
    const labels = (spec.annotations && spec.annotations.labels) || {};
    return {
      tooltipFormatter: typeof (spec.tooltip && spec.tooltip.formatter),
      segmentFormatter: typeof (labels.segment && labels.segment.formatter),
    };
  });
  expect(hookish.tooltipFormatter).not.toBe('function');
  expect(hookish.segmentFormatter).not.toBe('function');
});
