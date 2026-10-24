const { test, expect } = require('@playwright/test');
const path = require('path');

const TILES = 'file://' + path.resolve(__dirname, 'fixture', 'tiles.html');

async function open(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(TILES);
  await expect(page.locator('#chart-tiles table')).toBeVisible();
  return errors;
}

const eventsOf = (page, type) =>
  page.evaluate(
    (t) => (window.__gsmEvents || []).filter((e) => e.type === t && e.chartId === 'chart-tiles'),
    type
  );

// Rows are rebuilt from the column-wise payload, so this also guards that
// HTMLWidgets.dataframeToD3() ran: column arrays would render no cells at all.
test('tiles() renders from column-wise data and exposes el.gsmChart', async ({ page }) => {
  const errors = await open(page);
  const state = await page.evaluate(() => {
    const el = document.getElementById('chart-tiles');
    const ch = el.gsmChart;
    return {
      hasChart: !!ch,
      helpers: Object.keys(ch.helpers).sort(),
      rows: ch.data.length,
      firstRow: ch.data[0],
      expandRows: ch.spec.expand.data.length,
      meta: el.gsmMeta,
      classes: Array.from(el.classList),
      getState: ch.helpers.getState(ch),
    };
  });
  expect(state.hasChart).toBe(true);
  expect(state.helpers).toEqual([
    'clearSelection', 'collapseColumn', 'expandColumn', 'getState', 'selectRow',
    'updateData', 'updateSpec',
  ]);
  expect(state.rows).toBe(5);
  expect(state.firstRow).toEqual({ subjid: 'P1', vital: 'Pulse', flag: 'Red', rate: '2/3' });
  expect(state.expandRows).toBe(5);
  expect(state.meta).toEqual({ chartId: 'chart-tiles', level: 'subject' });
  expect(state.classes).toContain('gsm-vizr-tiles');
  expect(state.getState).toEqual({ expanded: [], selected: null, page: 1 });

  // A one-value scales.y.order must arrive as an array: P3 is listed first.
  const rowHeaders = await page.locator('#chart-tiles .gsm-tiles-row-header').allTextContents();
  expect(rowHeaders).toEqual(['P3', 'P1', 'P2']);
  // P3 has no SBP row; NA fill arrives as null and renders neutral, not missing.
  await expect(page.locator('#chart-tiles .gsm-tiles-missing')).toHaveCount(1);
  // The js_hook tooltip formatter was revived into a function.
  await expect(page.locator('#chart-tiles td.gsm-tiles-cell').first()).toHaveAttribute(
    'title',
    'hook P3 Pulse'
  );
  expect(errors).toEqual([]);
});

test('cell click dispatches a gsm-viz-select click event', async ({ page }) => {
  const errors = await open(page);
  await page.locator('#chart-tiles td.gsm-tiles-cell[title="hook P1 SBP"]').click();
  const clicks = await eventsOf(page, 'click');
  expect(clicks).toHaveLength(1);
  expect(clicks[0]).toEqual({
    type: 'click',
    chartId: 'chart-tiles',
    datum: { subjid: 'P1', vital: 'SBP', flag: 'Green', rate: '0/2' },
    metadata: { chartId: 'chart-tiles', level: 'subject' },
  });
  expect(errors).toEqual([]);
});

test('row header click dispatches rowclick, runs the user hook, and does not select', async ({ page }) => {
  const errors = await open(page);
  await page.locator('#chart-tiles .gsm-tiles-row-header', { hasText: 'P1' }).click();
  const rowclicks = await eventsOf(page, 'rowclick');
  expect(rowclicks).toHaveLength(1);
  expect(rowclicks[0].y).toBe('P1');
  expect(rowclicks[0].rows.map((r) => r.vital)).toEqual(['Pulse', 'SBP']);
  expect(rowclicks[0].metadata).toEqual({ chartId: 'chart-tiles', level: 'subject' });
  // User hooks run after the event, with `this` bound to the widget element.
  expect(await page.evaluate(() => window.__rowHook)).toEqual({ y: 'P1', self: 'chart-tiles' });

  const selected = await page.evaluate(() => {
    const ch = document.getElementById('chart-tiles').gsmChart;
    const before = ch.helpers.getState(ch).selected;
    ch.helpers.selectRow(ch, 'P1');
    return { before, after: ch.helpers.getState(ch).selected };
  });
  expect(selected).toEqual({ before: null, after: 'P1' });
  await expect(page.locator('#chart-tiles tr.gsm-tiles-selected th')).toHaveText('P1');
  expect(errors).toEqual([]);
});

test('column expand and collapse dispatch expand events', async ({ page }) => {
  const errors = await open(page);
  const toggle = page.locator('#chart-tiles .gsm-tiles-toggle').first();
  await toggle.click();
  await expect(page.locator('#chart-tiles td.gsm-tiles-detail')).toHaveCount(9);
  await expect(page.locator('#chart-tiles td.gsm-tiles-detail[title="detail 2"]')).toHaveCount(1);
  await page.locator('#chart-tiles .gsm-tiles-toggle').first().click();
  await expect(page.locator('#chart-tiles td.gsm-tiles-detail')).toHaveCount(0);

  const expands = await eventsOf(page, 'expand');
  expect(expands).toEqual([
    {
      type: 'expand',
      chartId: 'chart-tiles',
      x: 'Pulse',
      expanded: true,
      metadata: { chartId: 'chart-tiles', level: 'subject' },
    },
    {
      type: 'expand',
      chartId: 'chart-tiles',
      x: 'Pulse',
      expanded: false,
      metadata: { chartId: 'chart-tiles', level: 'subject' },
    },
  ]);
  expect(errors).toEqual([]);
});
