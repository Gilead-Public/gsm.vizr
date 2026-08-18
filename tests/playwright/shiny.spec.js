const { test, expect } = require('@playwright/test');

const APP = 'http://127.0.0.1:8123';

async function selection(page) {
  return page.evaluate(() =>
    document
      .getElementById('chart')
      .gsmChart.helpers.getSelection(document.getElementById('chart').gsmChart)
  );
}

test('silent proxy selection applies without echoing a select event', async ({ page }) => {
  await page.goto(APP);
  await expect(page.locator('#chart canvas')).toBeVisible();
  const before = await page.evaluate(() => (window.__gsmEvents || []).length);
  await page.click('#btnSelect');
  await expect.poll(() => selection(page)).toMatchObject({
    type: 'category',
    values: ['S1'],
  });
  const after = await page.evaluate(() => (window.__gsmEvents || []).length);
  expect(after).toBe(before); // _silent: no event, no Shiny echo
});

test('loud proxy selection reaches input$chart_select', async ({ page }) => {
  await page.goto(APP);
  await expect(page.locator('#chart canvas')).toBeVisible();
  await page.click('#btnLoud');
  await expect(page.locator('#sel')).toContainText('S2');
});

test('proxy clear + updateData rebuild the chart', async ({ page }) => {
  await page.goto(APP);
  await expect(page.locator('#chart canvas')).toBeVisible();
  await page.click('#btnClear');
  await expect.poll(() => selection(page)).toMatchObject({ type: null });
  await page.click('#btnSwap');
  await expect
    .poll(async () =>
      page.evaluate(() => document.getElementById('chart').gsmChart.data.labels)
    )
    .toContain('S3');
});

test('a js_hook sent by proxy arrives as a live function', async ({ page }) => {
  await page.goto(APP);
  await expect(page.locator('#chart canvas')).toBeVisible();
  await page.click('#btnHook');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof document.getElementById('chart').gsmChart.data._spec_.tooltip.formatter
      )
    )
    .toBe('function');
});

// Collect what the handler's throw actually surfaces as. Shiny wraps custom
// message dispatch in its own try/catch, so the error never becomes an uncaught
// pageerror: it arrives as console.error, prefixed
// "[shiny] Error on client while running Shiny app - ...", with a stack into
// bars.js. Listening on pageerror alone sees nothing and reports the loud
// failure as silent.
function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('a proxy verb against a facet widget fails loudly', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(APP);
  await expect(page.locator('#facetChart canvas').first()).toBeVisible();
  await page.click('#btnFacet');
  // The point of the fix: a developer sees a named error, not silence.
  await expect
    .poll(() => errors.join('\n'))
    .toContain('is not supported on the faceted widget');
  // Named specifically enough to act on: which widget, which verb.
  expect(errors.join('\n')).toContain('facetChart');
  expect(errors.join('\n')).toContain('clearSelection');
});

// Throwing inside a Shiny custom message handler is louder than console.error,
// but it propagates into Shiny's message dispatch, so it could in principle
// take sibling messages down with it. This measures the blast radius: both
// verbs leave R in one reactive flush, so the browser receives them in a single
// batch, the facet one throwing first. Measured result: Shiny catches per
// handler invocation, the sibling select still applies, and the session stays
// live - which is what makes throwing safe to keep rather than downgrading to
// console.error and return.
test('a facet throw does not take down a sibling verb in the same batch', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto(APP);
  await expect(page.locator('#chart canvas')).toBeVisible();
  await expect(page.locator('#facetChart canvas').first()).toBeVisible();
  await page.click('#btnClear');
  await expect.poll(() => selection(page)).toMatchObject({ type: null });

  await page.click('#btnBoth');
  await expect
    .poll(() => errors.join('\n'))
    .toContain('is not supported on the faceted widget');
  await expect.poll(() => selection(page)).toMatchObject({
    type: 'category',
    values: ['S1'],
  });
});

// The Shiny counterpart to the static tabset fixture, and the case the
// binding's resizeOnReveal hook is actually for: Shiny sizes widgets from the
// live DOM, so a chart rendered inside a hidden tabPanel measures 0x0 and stays
// collapsed on reveal unless something resizes it. Asserting agreement with the
// revealed container, not width > 0, since a stale chart still reports a size.
test('a chart in a hidden Shiny tab is sized to its container on reveal', async ({
  page,
}) => {
  await page.goto(APP);
  await expect(page.locator('#chart canvas')).toBeVisible();

  const hidden = await page.evaluate(
    () => document.getElementById('tabChart').offsetWidth
  );
  expect(hidden).toBe(0); // the pane really is collapsed

  await page.click('a:has-text("hiddenTab")');
  await expect(page.locator('#tabChart canvas')).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const el = document.getElementById('tabChart');
        return el.gsmChart.width === el.offsetWidth && el.offsetWidth > 0;
      })
    )
    .toBe(true);
});

// A metadata$chartId must not rename a Shiny output element. The proxy handler
// resolves its target with getElementById(outputId) and the event glue derives
// input$<id>_click/_select from the same id, so a rename makes every proxy verb
// a silent no-op and writes inputs the server never reads - with no error.
test('a chartId does not rename a Shiny output, and warns instead', async ({ page }) => {
  const warnings = [];
  page.on('console', (m) => {
    if (m.type() === 'warning') warnings.push(m.text());
  });
  await page.goto(APP);
  // The chartId output lives in a tab, and Shiny suspends hidden outputs, so it
  // has not rendered yet - reveal it or renderValue never runs.
  await page.click('a:has-text("hiddenTab")');
  await expect(page.locator('#tabChart canvas')).toBeVisible();

  const ids = await page.evaluate(() => ({
    outputIdKept: !!document.getElementById('tabChart'),
    renamed: !!document.getElementById('should-be-ignored-under-shiny'),
  }));
  expect(ids.outputIdKept).toBe(true);
  expect(ids.renamed).toBe(false);

  // Ignoring it silently would be its own trap, so the author gets told.
  expect(warnings.join('\n')).toContain('should-be-ignored-under-shiny');
  expect(warnings.join('\n')).toContain('tabChart');
});

test('event glue survives a spec-carrying proxy_update_data', async ({ page }) => {
  await page.goto(APP);
  await expect(page.locator('#chart canvas')).toBeVisible();
  await page.click('#btnSpecSwap');
  await expect
    .poll(() => page.evaluate(() => document.getElementById('chart').gsmChart.data.labels))
    .toContain('S3');
  const grew = await page.evaluate(() => {
    const el = document.getElementById('chart');
    const before = (window.__gsmEvents || []).length;
    el.gsmChart.data._spec_.callbacks.onClick({ x: 'S3', _fill: '1', _datum: [] });
    return (window.__gsmEvents || []).length - before;
  });
  expect(grew).toBe(1); // glue re-composed, gsm-viz-select still dispatches
});

test('event glue wraps a user hook sent via proxy_update_spec', async ({ page }) => {
  await page.goto(APP);
  await expect(page.locator('#chart canvas')).toBeVisible();
  await page.click('#btnSpecHook');
  const result = await page.evaluate(async () => {
    const el = document.getElementById('chart');
    await new Promise((r) => setTimeout(r, 200));
    const before = (window.__gsmEvents || []).length;
    el.gsmChart.data._spec_.callbacks.onClick({ x: 'S1', _fill: '1', _datum: [] });
    return { grew: (window.__gsmEvents || []).length - before, hookRan: window.__hookRan === true };
  });
  expect(result).toEqual({ grew: 1, hookRan: true }); // glue AND user hook both run
});
