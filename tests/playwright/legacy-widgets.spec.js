const { test, expect } = require('@playwright/test');
const path = require('path');

const fixture = (name) => 'file://' + path.resolve(__dirname, 'fixture', name);
const ISOLATED = fixture('legacy-widgets.html');
const GALLERY = fixture('gallery.html');

// `.group-overview` and `.rbm-viz--example` are the only selectors main.css defines,
// and no other stylesheet on these pages declares them. Reading the CSSOM rather than
// looking for a <link href> is deliberate: the fixtures render self-contained, so every
// stylesheet arrives inlined in a <style> tag with its filename stripped.
const MAIN_CSS_SELECTOR = '.group-overview';

async function mainCssIsLoaded(page) {
  return page.evaluate(
    (selector) =>
      Array.from(document.styleSheets).some((sheet) =>
        Array.from(sheet.cssRules || []).some(
          (rule) => rule.selectorText && rule.selectorText.includes(selector)
        )
      ),
    MAIN_CSS_SELECTOR
  );
}

// Spec R1.1 proof. This page holds the relocated Widget_BarChart and nothing else, so
// every dependency it resolves comes from Widget_BarChart.yaml in gsm.vizr's own tree:
// the binding JS, the YAML-declared control libs, and the gsmViz bundle with main.css.
// The isolation is what makes the stylesheet assertion a guard - htmltools de-duplicates
// dependencies by name+version, so on a page that also carries a bars() chart the gsmViz
// entry from bars.yaml wins and the relocated YAML is never exercised. Deleting
// `stylesheet: 'main.css'` from Widget_BarChart.yaml fails this test and only this test.
test('relocated Widget_BarChart resolves every dependency from gsm.vizr', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(ISOLATED);

  // Binding JS and the YAML-declared control libs: a missing one throws or leaves the
  // container chartless.
  await expect(page.locator('#page-legacy-barchart canvas')).toBeVisible();
  const gsmVizLoaded = await page.evaluate(() => typeof window.gsmViz !== 'undefined');
  expect(gsmVizLoaded).toBe(true);

  // The bundle's stylesheet. A missing stylesheet raises no JS error, so nothing above
  // would catch it.
  expect(await mainCssIsLoaded(page)).toBe(true);

  expect(errors).toEqual([]);
});

// The relocated widget must also survive on a page alongside the bars() family, which is
// how gsm.kri reports compose today. Here the gsmViz bundle is shared rather than
// resolved from the relocated YAML, so this case proves coexistence, not resolution.
test('relocated Widget_BarChart coexists with bars() widgets on one page', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(GALLERY);
  await expect(page.locator('#page-legacy-barchart canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
