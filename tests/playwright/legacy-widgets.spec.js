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

// `addWidgetControls()` returns `{ widgetControls: null }` when bAddGroupSelect is FALSE,
// and `addOutcomeSelect()` appends into that container unconditionally. Without a guard the
// binding throws a TypeError mid-render, so the canvas never appears and the page reports an
// error. Widget_TimeSeries.js has always guarded this call; Widget_BarChart.js had not.
test('relocated Widget_BarChart renders with bAddGroupSelect = FALSE', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(ISOLATED);

  const container = page.locator('#page-legacy-barchart-nocontrols');
  await expect(container.locator('canvas')).toBeVisible();
  // The suppressed controls must genuinely be absent, else the guard is untested.
  await expect(container.locator('.gsm-widget-controls')).toHaveCount(0);

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

// Both widgets on this page render the same metric and outcome, so a purely
// data-derived el.id collides. Duplicate DOM ids make getElementById and every
// `#id` selector resolve to whichever came first.
test('two widgets for the same metric keep unique element ids', async ({ page }) => {
  await page.goto(ISOLATED);
  await expect(page.locator('#page-legacy-barchart canvas')).toBeVisible();
  const ids = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[id^="barChart--"]')).map((n) => n.id)
  );
  expect(ids.length).toBe(2);
  expect(new Set(ids).size).toBe(2); // data-derived prefix, unique suffix
  ids.forEach((id) => expect(id).toMatch(/^barChart--Analysis_kri0001_/));
});

// Labels and option values are plain data - GroupIDs, country names, outcome
// labels - so markup in them is a report-rendering injection, never intent.
test('select control renders labels and values as text, not markup', async ({ page }) => {
  await page.goto(ISOLATED);
  const result = await page.evaluate(() => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    addSelectControl(host, '<img src=x onerror="window.__pwned=1">', ['<b>v</b>'], true, 'None');
    return {
      labelHasElement: !!host.querySelector('.gsm-widget-control--label img'),
      optionHasElement: !!host.querySelector('option b'),
      optionText: host.querySelectorAll('option')[1].textContent,
    };
  });
  expect(result).toEqual({ labelHasElement: false, optionHasElement: false, optionText: '<b>v</b>' });
});
