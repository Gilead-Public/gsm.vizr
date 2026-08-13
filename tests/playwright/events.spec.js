const { test, expect } = require('@playwright/test');
const path = require('path');

const GALLERY = 'file://' + path.resolve(__dirname, 'fixture', 'gallery.html');

// Load the gallery and halt every chart's entry animation before interacting.
// Clicks are silently dropped while Chart.js animations are in flight anywhere
// on the page, and the gallery renders nine charts at once, so an unsettled
// page makes any click-driven assertion intermittently fail.
async function openSettled(page) {
  await page.goto(GALLERY);
  await page.evaluate(() => {
    const settle = (c) => {
      c.stop();
      c.update('none');
    };
    document.querySelectorAll('.gsm-vizr').forEach((el) => {
      if (el.gsmChart) settle(el.gsmChart);
      if (el.gsmFacet) el.gsmFacet.charts.forEach(settle);
    });
  });
}

const clicksOn = (page, chartId) =>
  page.evaluate(
    (id) => (window.__gsmEvents || []).filter((e) => e.type === 'click' && e.chartId === id).length,
    chartId
  );

// Click the center of one rendered bar via Chart.js element metadata.
//
// Two things this has to survive:
//
// 1. The chart must be scrolled into view. getBoundingClientRect() and
//    page.mouse are both viewport-relative, so a chart below the fold yields
//    coordinates outside the viewport and the click lands nowhere.
//
// 2. Chart.js resolves the clicked bar from hover state that it updates on a
//    requestAnimationFrame-throttled mousemove, while the click handler itself
//    is not throttled. A synthesized click can therefore be processed before
//    the hover has resolved, and gsm.viz's onClick then sees no active element
//    and treats it as a click on empty space - silently, with correct
//    coordinates and stable geometry, which is what makes it so confusing to
//    diagnose. Retrying is safe precisely because a dropped click changes
//    nothing: no event, no selection, no toggle. So drive the click until one
//    registers rather than sleeping and hoping.
async function clickBar(page, chartId, datasetIndex, index) {
  const before = await clicksOn(page, chartId);
  for (let attempt = 0; attempt < 20; attempt++) {
    const pos = await page.evaluate(
      ([id, di, i]) => {
        const el = document.getElementById(id);
        el.scrollIntoView({ block: 'center' });
        const ch = el.gsmChart;
        ch.stop();
        ch.update('none');
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
    await page.mouse.move(pos.x, pos.y);
    await page.mouse.click(pos.x, pos.y);
    if ((await clicksOn(page, chartId)) > before) return;
  }
  throw new Error('click on ' + chartId + ' never registered after 20 attempts');
}

test('bar click dispatches gsm-viz-select click and select events', async ({ page }) => {
  await openSettled(page);
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
// yields undefined on count charts, so both shapes are pinned rather than left
// to the vignette.
//
// Deliberately two tests, one chart each. A single test clicking both charts in
// sequence is flaky: the second click stops registering unless several hundred
// ms have passed since the first, and no amount of scrolling, hovering or frame
// yielding substitutes for that wait (the bar geometry is provably stable the
// whole time). Playwright gives each test its own page, so one click per test
// removes the interaction entirely rather than papering over it with a sleep.
test('datum is the aggregated rows under stat count', async ({ page }) => {
  await openSettled(page);
  await clickBar(page, 'chart-select', 0, 0);
  const events = await page.evaluate(() => window.__gsmEvents || []);
  const count = events.find((e) => e.type === 'click' && e.chartId === 'chart-select');
  expect(count).toBeTruthy();
  expect(Array.isArray(count.datum)).toBe(true);
  expect(count.datum.length).toBeGreaterThan(0);
  expect(count.datum[0].site).toBeTruthy();
});

test('datum is a single row under stat identity', async ({ page }) => {
  await openSettled(page);
  await clickBar(page, 'chart-select-identity', 0, 0);
  const events = await page.evaluate(() => window.__gsmEvents || []);
  const identity = events.find(
    (e) => e.type === 'click' && e.chartId === 'chart-select-identity'
  );
  expect(identity).toBeTruthy();
  expect(Array.isArray(identity.datum)).toBe(false);
  expect(identity.datum.site).toBeTruthy();
});

// The glue wraps spec.callbacks, so a user hook at the same slot must still be
// called rather than overwritten. Nothing in R can observe this.
test('the wrapper event fires alongside a user js_hook callback', async ({ page }) => {
  await openSettled(page);
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
  await openSettled(page);
  await page.evaluate(() => {
    window.__bubbled = [];
    document.addEventListener('gsm-viz-select', (e) => window.__bubbled.push(e.detail));
  });
  await clickBar(page, 'chart-select', 0, 0);
  const bubbled = await page.evaluate(() => window.__bubbled);
  expect(bubbled.length).toBeGreaterThan(0);
  expect(bubbled.some((d) => d.chartId === 'chart-select')).toBe(true);
});
