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

test('downstream replica pages render with their contract features', async ({ page }) => {
  await page.goto(GALLERY);
  const qtl = await page.evaluate(() => {
    const el = document.getElementById('chart-qtl-replica');
    const ch = el.gsmChart;
    const s = ch.data._spec_;
    return {
      minH: el.style.minHeight,
      height: el.offsetHeight,
      indexAxis: ch.options.indexAxis,
      position: s.position,
      stat: s.stat,
      captions: s.labels.captions.length,
      xOrder: s.scales.x.order,
      fillOrder: s.scales.fill.order,
      // Every category's segments must sum to 100 under position: fill.
      firstCategoryTotal: ch.data.datasets.reduce(
        (sum, d) => sum + Number(d.data[0]),
        0
      ),
      valueAxisMax: ch.scales[ch.options.indexAxis === 'y' ? 'x' : 'y'].max,
    };
  });
  expect(qtl.minH).toBe('500px');
  expect(qtl.height).toBeGreaterThanOrEqual(500);
  expect(qtl.indexAxis).toBe('y');
  // position "fill" normalizes to {position: stack, stat: percent} upstream.
  expect(qtl.position).toBe('stack');
  expect(qtl.stat).toBe('percent');
  expect(qtl.captions).toBe(2);
  expect(qtl.fillOrder).toEqual(['Eligible', 'Excluded', 'Pending']); // factor levels
  expect(qtl.xOrder).toHaveLength(6);
  // Normalization shows up on the data or on the axis; assert whichever holds.
  const normalized =
    Math.abs(qtl.firstCategoryTotal - 100) < 0.5 || qtl.valueAxisMax === 100;
  expect(normalized).toBe(true);

  const ep = await page.evaluate(() => {
    const ch = document.getElementById('chart-endpoints-replica').gsmChart;
    return {
      formatter: typeof ch.data._spec_.tooltip.formatter,
      segLabels: ch.data._spec_.annotations.labels.segment.display,
      colors: ch.data._spec_.scales.fill.colors,
    };
  });
  expect(ep.formatter).toBe('function');
  expect(ep.segLabels).toBe(true);
  expect(ep.colors.Event).toBe('#c91b1d');
});

test('facet, shared-dependency, and empty pages render without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(GALLERY);
  const facet = await page.evaluate(() => {
    const el = document.getElementById('chart-facet');
    // facetBars strips the facet key when splitting the spec, so the sub-charts
    // carry no record of it. The order is observable where it actually matters:
    // the rendered panel headings, in DOM order.
    return {
      n: el.gsmFacet.charts.length,
      panels: Array.from(el.gsmFacet.container.querySelectorAll('.gsm-facet-cell')).map(
        (cell) => cell.innerText.trim().split('\n')[0]
      ),
    };
  });
  expect(facet.n).toBe(2);
  // facet$order is the array slot no order derivation covers - only
  // .normalize_spec_arrays() keeps it an array, and this proves it took effect.
  expect(facet.panels).toEqual(['USA', 'CAN']);
  const pd = await page.evaluate(
    () => !!document.getElementById('chart-pd-dependency').gsmChart
  );
  expect(pd).toBe(true);
  const empty = await page.evaluate(
    () => !!document.querySelector('#chart-empty canvas')
  );
  expect(empty).toBe(true);
  expect(errors).toEqual([]);
});

test('a static report drives a bars() chart through chart.helpers, no Shiny', async ({
  page,
}) => {
  // The access path gsm.endpoints and the gsm.kri PD report actually need:
  // bars_proxy() requires a Shiny session, chart.helpers does not.
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(GALLERY);
  const id = 'chart-static-helpers';
  expect(
    await page.evaluate((i) => document.getElementById(i).gsmChart.data.labels.length, id)
  ).toBe(3);

  await page.click('#btn-static-update');
  await expect
    .poll(() => page.evaluate((i) => document.getElementById(i).gsmChart.data.labels, id))
    .not.toContain('S-003');

  await page.click('#btn-static-select');
  await expect
    .poll(() =>
      page.evaluate((i) => {
        const ch = document.getElementById(i).gsmChart;
        return ch.helpers.getSelection(ch);
      }, id)
    )
    .toMatchObject({ type: 'category', values: ['S-001'] });

  expect(errors).toEqual([]); // nothing on this page is Shiny
});

test('pre-aggregated identity stack keeps factor order, titles and single-row datum', async ({
  page,
}) => {
  await page.goto(GALLERY);
  const q = await page.evaluate(() => {
    const ch = document.getElementById('chart-qtl-identity').gsmChart;
    const s = ch.data._spec_;
    return {
      stat: s.stat,
      position: s.position || 'stack',
      indexAxis: ch.options.indexAxis,
      xOrder: s.scales.x.order,
      fillOrder: s.scales.fill.order,
      colors: s.scales.fill.colors,
      captions: [].concat(s.labels.captions).length,
      title: s.labels.title,
      xLabel: s.scales.x.label,
      yLabel: s.scales.y.label,
    };
  });
  expect(q.stat).toBe('identity');
  expect(q.indexAxis).toBe('y');
  expect(q.xOrder).toEqual(['INV-4', 'INV-3', 'INV-2', 'INV-1']); // fct_rev order
  expect(q.fillOrder).toEqual(['Ineligible', 'No Eligibility Risk', 'Neither']);
  expect(q.colors.Ineligible).toBe('#FF5859');
  expect(q.captions).toBe(1);
  // Titles ARE supported in 2.4.1 — no fidelity gap for downstream consumers.
  expect(q.title).toBe('Eligibility criteria by investigator');
  expect(q.xLabel).toBe('Investigator');
  expect(q.yLabel).toBe('Participants');
});

test('dynamicSizing grows past the minHeight floor at the gsm.qtl rate', async ({
  page,
}) => {
  await page.goto(GALLERY);
  const m = await page.evaluate(() => {
    const el = document.getElementById('chart-dynamic-many');
    return {
      h: el.offsetHeight,
      n: el.gsmChart.data.labels.length,
      px: el.gsmChart.data._spec_.theme.pxPerCategory,
    };
  });
  expect(m.n).toBe(24);
  // The point of the page: the floor must NOT be what determines this height.
  expect(m.h).toBeGreaterThan(500);
  // theme$pxPerCategory is a real spec key, so gsm.qtl's calc_fig_size()
  // growth of 25px/site is reproducible rather than a known divergence.
  expect(m.px).toBe(25);
  expect(m.h).toBeGreaterThanOrEqual(m.n * m.px);
  console.log(
    `dynamicSizing: ${m.h}px for ${m.n} categories ` +
      `(${(m.h / m.n).toFixed(1)}px/category at pxPerCategory=${m.px})`
  );
});

test('outside total labels are configured (clipping is a known limitation)', async ({
  page,
}) => {
  await page.goto(GALLERY);
  const t = await page.evaluate(
    () =>
      document.getElementById('chart-outside-labels').gsmChart.data._spec_.annotations
        .labels.total
  );
  expect(t.display).toBe(true);
  expect(t.placement).toBe('outside');
  // Deliberately NOT asserting the labels are unclipped - they are not, and
  // that is the reproduction case for the upstream ask.
});
