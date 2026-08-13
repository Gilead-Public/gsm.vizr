const { test, expect } = require('@playwright/test');
const path = require('path');

const GALLERY = 'file://' + path.resolve(__dirname, 'fixture', 'gallery.html');

// Click the center of one rendered bar via Chart.js element metadata.
// The chart must be scrolled into view first: getBoundingClientRect() is
// viewport-relative and so is page.mouse, so a chart below the fold yields
// coordinates outside the viewport and the click silently lands nowhere.
async function clickBar(page, chartId, datasetIndex, index) {
  await page.evaluate(
    (id) => document.getElementById(id).scrollIntoView({ block: 'center' }),
    chartId
  );
  const pos = await page.evaluate(
    ([id, di, i]) => {
      const ch = document.getElementById(id).gsmChart;
      const m = ch.getDatasetMeta(di).data[i];
      const r = ch.canvas.getBoundingClientRect();
      const cx =
        ch.data._spec_.orientation === 'horizontal' ? (m.x + m.base) / 2 : m.x;
      const cy =
        ch.data._spec_.orientation === 'horizontal' ? m.y : (m.y + m.base) / 2;
      return { x: r.left + cx, y: r.top + cy };
    },
    [chartId, datasetIndex, index]
  );
  await page.mouse.click(pos.x, pos.y);
}

test('bar click dispatches gsm-viz-select click and select events', async ({ page }) => {
  await page.goto(GALLERY);
  await clickBar(page, 'chart-select', 0, 0);
  const events = await page.evaluate(() => window.__gsmEvents || []);
  const click = events.find((e) => e.type === 'click' && e.chartId === 'chart-select');
  expect(click).toBeTruthy();
  expect(click.metadata.level).toBe('site');
  expect(click.category).toBeTruthy();
  expect(click.datum).toBeTruthy();
  const select = events.find((e) => e.type === 'select' && e.chartId === 'chart-select');
  expect(select).toBeTruthy();
  expect(select.selection.type).toBe('category');
  expect(select.selection.values).toContain(click.category);
});

// The one field of the contract whose shape is not constant. Upstream sets
// point._datum to the aggregated rows array under stat "count" and to the
// single row under stat "identity"; the wrapper forwards it unchanged. A
// consumer writing detail.datum.invid works on identity charts and silently
// yields undefined on count charts, so both shapes are pinned here rather than
// left to the vignette.
test('datum is the aggregated rows under count and a single row under identity', async ({
  page,
}) => {
  await page.goto(GALLERY);
  await clickBar(page, 'chart-select', 0, 0);
  await clickBar(page, 'chart-select-identity', 0, 0);
  const events = await page.evaluate(() => window.__gsmEvents || []);

  const count = events.find((e) => e.type === 'click' && e.chartId === 'chart-select');
  expect(Array.isArray(count.datum)).toBe(true);
  expect(count.datum.length).toBeGreaterThan(0);
  expect(count.datum[0].site).toBeTruthy();

  const identity = events.find(
    (e) => e.type === 'click' && e.chartId === 'chart-select-identity'
  );
  expect(Array.isArray(identity.datum)).toBe(false);
  expect(identity.datum.site).toBeTruthy();
});

// The glue wraps spec.callbacks, so a user hook at the same slot must still be
// called rather than overwritten. Nothing in R can observe this.
test('the wrapper event fires alongside a user js_hook callback', async ({ page }) => {
  await page.goto(GALLERY);
  await page.evaluate(() => {
    const spec = document.getElementById('chart-select').gsmChart.data._spec_;
    const wrapped = spec.callbacks.onClick;
    window.__userHookCalls = [];
    spec.callbacks.onClick = function (point, event) {
      window.__userHookCalls.push(point);
      return wrapped(point, event);
    };
  });
  await clickBar(page, 'chart-select', 0, 0);
  const calls = await page.evaluate(() => window.__userHookCalls.length);
  const events = await page.evaluate(() =>
    (window.__gsmEvents || []).filter((e) => e.chartId === 'chart-select' && e.type === 'click')
  );
  expect(calls).toBeGreaterThan(0);
  expect(events.length).toBeGreaterThan(0);
});

// The event must reach a report-level listener on an ancestor, not just the
// widget div — that is the whole point of bubbles: true.
test('gsm-viz-select bubbles to document level', async ({ page }) => {
  await page.goto(GALLERY);
  await page.evaluate(() => {
    window.__bubbled = [];
    document.addEventListener('gsm-viz-select', (e) => window.__bubbled.push(e.detail));
  });
  await clickBar(page, 'chart-select', 0, 0);
  const bubbled = await page.evaluate(() => window.__bubbled);
  expect(bubbled.length).toBeGreaterThan(0);
  expect(bubbled.some((d) => d.chartId === 'chart-select')).toBe(true);
});
