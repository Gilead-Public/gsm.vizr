const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

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

test('GroupOverview adds comparison score immediately after Risk Score', async ({ page }) => {
  await page.goto(ISOLATED);

  const overview = page.locator('#page-group-overview-comparison');
  await expect(overview.locator('table.group-overview')).toBeVisible();

  const headers = await overview.locator('th').allInnerTexts();
  const riskIndex = headers.indexOf('Risk Score');
  expect(riskIndex).toBeGreaterThan(-1);
  expect(headers[riskIndex + 1]).toBe('Adjusted Risk Score');

  const firstRow = overview.locator('tbody tr').first();
  const baseline = Number(await firstRow.locator('td').nth(riskIndex).innerText());
  const adjusted = Number(await firstRow.locator('td').nth(riskIndex + 1).innerText());
  expect(Number.isFinite(baseline)).toBe(true);
  expect(Math.abs(adjusted - baseline / 2)).toBeLessThanOrEqual(0.5);
});

test('GroupOverview keeps its original columns when comparison score is absent', async ({ page }) => {
  await page.goto(ISOLATED);

  const overview = page.locator('#page-group-overview-baseline');
  await expect(overview.locator('table.group-overview')).toBeVisible();
  await expect(
    overview.locator('th', { hasText: 'Adjusted Risk Score' })
  ).toHaveCount(0);
});

test('90-day action borders mark only the specific site KRI without score controls', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(ISOLATED);
  const source = fs.readFileSync(path.resolve(
    __dirname, '../../inst/htmlwidgets/lib/addComparisonRiskDetail.js'
  ), 'utf8');
  await page.evaluate((script) => {
    const host = document.createElement('div');
    host.id = 'action-window-overview';
    document.body.replaceChildren(host);
    const detail = ['1001', '1002'].flatMap((GroupID) => [
      {
        GroupID, MetricID: 'Analysis_kri0001', Flag: 2,
        Weight: 4, WeightMax: 4,
        EffectiveWeight: GroupID === '1001' ? 0 : 4,
        LastActionedDate: '2026-10-15', DaysSinceAction: 20,
        DecisionCoversFinding: GroupID === '1001',
        ActionState: 'Closed Action',
        ActionReason: GroupID === '1001' ? 'Recently addressed' : 'Decision coverage unknown',
        ActionAsOfDate: '2026-11-04', ActionWindowDays: 90,
        ActionRiskSignalID: 'RS-older', ActionID: 'ACT-1'
      },
      {
        GroupID, MetricID: 'Analysis_kri0002', Flag: GroupID === '1001' ? 2 : 1,
        Weight: GroupID === '1001' ? 4 : 2, WeightMax: 4,
        EffectiveWeight: GroupID === '1001' ? 4 : 2,
        LastActionedDate: GroupID === '1001' ? '2026-08-05' : '2026-08-06',
        DaysSinceAction: GroupID === '1001' ? 91 : 90,
        DecisionCoversFinding: false, ActionState: 'No Action',
        ActionReason: GroupID === '1001' ? 'Expired' : 'Decision coverage unknown',
        ActionAsOfDate: '2026-11-04', ActionWindowDays: 90
      },
      {
        GroupID, MetricID: 'Analysis_kri0003', Flag: 0,
        Weight: 0, WeightMax: 0, EffectiveWeight: 0,
        LastActionedDate: GroupID === '1001' ? '2026-10-15' : '2026-11-05',
        DaysSinceAction: GroupID === '1001' ? 20 : -1,
        DecisionCoversFinding: false, ActionState: 'Open Action',
        ActionReason: 'Decision coverage unknown', ActionAsOfDate: '2026-11-04', ActionWindowDays: 90
      },
      {
        GroupID, MetricID: 'Analysis_kri0004', Flag: 0,
        Weight: 0, WeightMax: 0, EffectiveWeight: 0,
        LastActionedDate: null, DaysSinceAction: null,
        DecisionCoversFinding: false, ActionState: null,
        ActionReason: 'Unknown', ActionAsOfDate: '2026-11-04', ActionWindowDays: 90
      }
    ]);
    const results = detail.map((row) => ({
      ...row, GroupLevel: 'Site', Numerator: 1, Denominator: 2,
      Metric: 0.5, Score: row.Flag
    }));
    ['1001', '1002'].forEach((GroupID) => {
      results.push({ GroupID, GroupLevel: 'Site', MetricID: 'Analysis_srs0001',
        Numerator: GroupID === '1001' ? 8 : 6, Denominator: 8,
        Metric: GroupID === '1001' ? 100 : 75,
        Score: GroupID === '1001' ? 100 : 75, Flag: null });
      results.push({ GroupID, GroupLevel: 'Site', MetricID: 'Analysis_srs0002',
        Numerator: GroupID === '1001' ? 4 : 6, Denominator: 8,
        Metric: GroupID === '1001' ? 50 : 75,
        Score: GroupID === '1001' ? 50 : 75, Flag: null });
    });
    const metrics = [1, 2, 3, 4].map((index) => ({
      MetricID: `Analysis_kri000${index}`, Metric: `KRI ${index}`,
      Abbreviation: `KRI ${index}`, GroupLevel: 'Site', Type: 'Analysis',
      Priority: index, Numerator: 'Events', Denominator: 'Participants',
      Score: 'Score', Threshold: '1,2'
    }));
    const input = {
      dfResults: results, dfMetrics: metrics,
      dfComparisonRiskDetail: detail, strComparisonRiskMetric: 'Analysis_srs0002',
      strComparisonRiskLabel: 'Review Priority Score'
    };
    const instance = gsmViz.default.groupOverview(host, results, {
      GroupLevel: 'Site', SiteRiskScoreMetricID: 'Analysis_srs0001',
      ComparisonRiskScoreMetricID: 'Analysis_srs0002',
      ComparisonRiskScoreLabel: 'Review Priority Score'
    }, ['1001', '1002'].map((GroupID) => ({
      GroupID, GroupLevel: 'Site', Param: 'InvestigatorLastName', Value: GroupID
    })), metrics);
    const attach = new Function(`${script}\nreturn addComparisonRiskDetail;`)();
    window.actionBorderBackgrounds = [...host.querySelectorAll('td.group-overview--metric')]
      .map((cell) => [cell.__data__.GroupID, cell.__data__.MetricID, getComputedStyle(cell).backgroundColor]).sort();
    attach(host, input, instance);
    window.actionWindowRedraw = () => instance.updateTable(results);
  }, source);

  const overview = page.locator('#action-window-overview');
  const values = () => overview.locator('td.group-overview--comparisonRiskScore')
    .evaluateAll((cells) => Object.fromEntries(cells.map((cell) => [cell.__data__.GroupID, cell.textContent])));
  await expect(overview.getByRole('spinbutton', { name: 'Action window (days)' })).toHaveCount(0);
  await expect(overview.getByRole('checkbox')).toHaveCount(1);
  const highlightToggle = overview.getByRole('checkbox', { name: 'Highlight actions within 90 days' });
  await expect(highlightToggle).toBeChecked();
  expect(await values()).toEqual({ '1001': '50', '1002': '75' });
  const expectedBorders = [
    '1001:Analysis_kri0001', '1001:Analysis_kri0003',
    '1002:Analysis_kri0001', '1002:Analysis_kri0002'
  ];
  const borderedCells = () => overview.locator('td.group-overview--recent-action')
    .evaluateAll((cells) => cells.map((cell) => `${cell.__data__.GroupID}:${cell.__data__.MetricID}`).sort());
  expect(await borderedCells()).toEqual(expectedBorders);
  await expect(overview.locator('td.group-overview--recent-action')).toHaveCount(4);
  await expect(overview.locator('td.group-overview--recent-action').first())
    .toHaveCSS('box-shadow', 'rgb(102, 102, 102) 0px 0px 0px 1px inset');
  await expect(overview.locator('td.group-overview--recent-action').first())
    .toHaveAttribute('title', /within 90 days.*2026-10-15/);
  expect(await overview.locator('td.group-overview--metric').evaluateAll((cells) =>
    cells.map((cell) => [cell.__data__.GroupID, cell.__data__.MetricID, getComputedStyle(cell).backgroundColor]).sort()
  )).toEqual(await page.evaluate(() => window.actionBorderBackgrounds));
  const flags = () => overview.locator('td.group-overview--metric')
    .evaluateAll((cells) => cells.map((cell) => [cell.__data__.GroupID, cell.__data__.MetricID, cell.__data__.Flag]).sort());
  const originalFlags = await flags();
  const baseline = await overview.locator('td.group-overview--siteRiskScore').allTextContents();
  await overview.locator('td.group-overview--comparisonRiskScore').first().click();
  await expect(overview.locator('.group-overview--comparison-detail')).toContainText('2026-10-15');
  await expect(overview.locator('.group-overview--comparison-detail')).toContainText('KRI 4');
  await expect(overview.locator('td.group-overview--metric')).toHaveCount(8);
  const detailText = await overview.locator('.group-overview--comparison-detail').innerText();
  await highlightToggle.uncheck();
  await expect(overview.locator('td.group-overview--recent-action')).toHaveCount(0);
  expect(await overview.locator('td.group-overview--metric').evaluateAll((cells) =>
    cells.every((cell) => getComputedStyle(cell).boxShadow === 'none')
  )).toBe(true);
  expect(await values()).toEqual({ '1001': '50', '1002': '75' });
  expect(await overview.locator('.group-overview--comparison-detail').innerText()).toBe(detailText);
  await overview.getByRole('columnheader', { name: 'Review Priority Score', exact: true }).click();
  await overview.getByRole('columnheader', { name: 'Review Priority Score', exact: true }).click();
  await expect(overview.locator('td.group-overview--comparisonRiskScore').first()).toHaveText('50');
  await page.evaluate(() => window.actionWindowRedraw());
  expect(await values()).toEqual({ '1001': '50', '1002': '75' });
  await expect(highlightToggle).not.toBeChecked();
  await expect(overview.locator('td.group-overview--recent-action')).toHaveCount(0);
  await highlightToggle.check();
  expect(await borderedCells()).toEqual(expectedBorders);
  await expect(overview.getByRole('columnheader', { name: 'Review Priority Score', exact: true })).toBeVisible();
  expect((await overview.locator('td.group-overview--siteRiskScore').allTextContents()).sort())
    .toEqual(baseline.sort());
  expect(await flags()).toEqual(originalFlags);
  const downloadPromise = page.waitForEvent('download');
  await overview.getByRole('button', { name: 'Download review data' }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(exported.settings).toMatchObject({ actionWindowDays: 90, highlightWindowDays: 90, highlightRecentActions: true });
  expect(exported.groups.find((group) => group.GroupID === '1001'))
    .toMatchObject({ OriginalRiskScore: 100, ReportedPriorityScore: 50, ReviewPriorityScore: 50 });
  await overview.screenshot({ path: test.info().outputPath('action-window-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(overview.getByRole('button', { name: 'Download review data' })).toBeVisible();
  expect(await overview.locator('.group-overview--action-controls').evaluate((controls) =>
    [...controls.children].every((control) => control.getBoundingClientRect().right <= controls.getBoundingClientRect().right + 1)
  )).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const scrollRegion = overview.getByRole('region', { name: 'Site risk and review priority scores' });
  expect(await scrollRegion.evaluate((region) => region.scrollWidth > region.clientWidth)).toBe(true);
  await scrollRegion.evaluate((region) => { region.scrollLeft = region.scrollWidth; });
  await expect(overview.locator('td.group-overview--recent-action').first()).toBeInViewport();
  await overview.screenshot({ path: test.info().outputPath('action-window-mobile.png') });
  expect(errors).toEqual([]);
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
