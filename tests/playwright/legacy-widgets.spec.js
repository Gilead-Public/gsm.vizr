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
        GroupID, MetricID: 'Analysis_kri0001', Flag: GroupID === '1001' ? 1 : 2,
        Weight: 4, WeightMax: 4,
        EffectiveWeight: GroupID === '1001' ? 0 : 4,
        LastActionedDate: '2026-10-15', DaysSinceAction: 20,
        DecisionCoversFinding: GroupID === '1001',
        ActionState: GroupID === '1001' ? 'Closed Action' : 'Awaiting Triage',
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
        ActionReason: 'Decision coverage unknown', ActionAsOfDate: '2026-11-04', ActionWindowDays: 90,
        LastFlaggedDate: GroupID === '1001' ? '2026-10-15' : null,
        LastFlaggedFlag: GroupID === '1001' ? -2 : null,
        DaysSinceFlag: GroupID === '1001' ? 20 : null
      },
      {
        GroupID, MetricID: 'Analysis_kri0004', Flag: null,
        Weight: 0, WeightMax: 0, EffectiveWeight: 0,
        LastActionedDate: null, DaysSinceAction: null,
        DecisionCoversFinding: false, ActionState: null,
        ActionReason: 'Unknown', ActionAsOfDate: '2026-11-04', ActionWindowDays: 90
      },
      {
        GroupID, MetricID: 'Analysis_kri0005', Flag: -1,
        Weight: 0, WeightMax: 0, EffectiveWeight: 0,
        LastActionedDate: null, DaysSinceAction: null,
        DecisionCoversFinding: false, ActionState: null,
        ActionReason: 'Unknown', ActionAsOfDate: '2026-11-04', ActionWindowDays: 90
      },
      {
        GroupID, MetricID: 'Analysis_kri0006', Flag: 0,
        Weight: 0, WeightMax: 0, EffectiveWeight: 0,
        LastActionedDate: 'NA', DaysSinceAction: null, ActionState: 'Not flagged',
        LastFlaggedDate: '2026-08-06', LastFlaggedFlag: 1, DaysSinceFlag: 90,
        ActionAsOfDate: '2026-11-04', ActionWindowDays: 90
      },
      {
        GroupID, MetricID: 'Analysis_kri0007', Flag: 0,
        Weight: 0, WeightMax: 0, EffectiveWeight: 0,
        LastActionedDate: null, DaysSinceAction: null, ActionState: 'Not recorded',
        LastFlaggedDate: '2026-08-05', LastFlaggedFlag: 2, DaysSinceFlag: 91,
        ActionAsOfDate: '2026-11-04', ActionWindowDays: 90
      }
    ].reverse()).map((row) => ({ StudyID: 'TEST-STUDY', SnapshotDate: '2026-11-04', GroupLevel: 'Site', ...row }));
    const exportRow = detail.find((row) => row.GroupID === '1001' && row.MetricID === 'Analysis_kri0001');
    exportRow.ActionedDateSource = 'ADO.Custom.SnapshotDate (proxy)';
    exportRow.ActionDateIsProxy = true;
    exportRow.SnapshotDecisionExcluded = true;
    exportRow.SnapshotDecisionReason = 'No Action, "reviewed"\nwithin window';
    exportRow.ActionRiskSignalID = '00042';
    exportRow.ActionID = '00043';
    detail.find((row) => row.GroupID === '1001' && row.MetricID === 'Analysis_kri0003')
      .SnapshotDecisionReason = '=HYPERLINK("https://example.invalid")';
    detail.find((row) => row.GroupID === '1001' && row.MetricID === 'Analysis_kri0005')
      .ActionedDateSource = '  +SUM(1,2)';
    detail.find((row) => row.GroupID === '1001' && row.MetricID === 'Analysis_kri0006')
      .SnapshotDecisionReason = '@SUM(1,2)';
    detail.find((row) => row.GroupID === '1002' && row.MetricID === 'Analysis_kri0001')
      .ActionedDateSource = '-formula-like-text';
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
    const metrics = [1, 2, 3, 4, 5, 6, 7].map((index) => ({
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
  await expect(overview.getByRole('button', { name: 'Download CSV' })).toBeVisible();
  const highlightToggle = overview.getByRole('checkbox', { name: 'Highlight actions within 90 days' });
  await expect(highlightToggle).toBeChecked();
  const downloadCsv = async (name) => {
    const pending = page.waitForEvent('download');
    await overview.getByRole('button', { name: 'Download CSV' }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe('risk-review_TEST-STUDY_2026-11-04.csv');
    await download.saveAs(test.info().outputPath(name));
    return fs.readFileSync(await download.path(), 'utf8');
  };
  const csv = await downloadCsv('risk-review.csv');
  expect(csv.slice(1).split('\r\n')[0].split(',').map((name) => name.slice(1, -1))).toEqual([
    'CSVSchemaVersion', 'StudyID', 'SnapshotDate', 'GroupLevel', 'GroupID', 'MetricID', 'MetricLabel',
    'CurrentFlag', 'ReviewFlag', 'LastFlaggedDate', 'DaysSinceFlag', 'ActionState', 'ActionedFlag',
    'LastAddressed', 'DaysAgo', 'ActionedDateSource', 'ActionDateIsProxy', 'ActionWindowDays',
    'Weight', 'WeightMax', 'EffectiveWeight', 'Counted', 'ActionFactor', 'SnapshotDecisionExcluded',
    'DecisionReason', 'DecisionCoversFinding', 'SiteRiskScore',
    'SiteRiskNumerator', 'SiteRiskDenominator', 'ComparisonRiskScore', 'ComparisonRiskNumerator',
    'ComparisonRiskDenominator', 'ComparisonRiskMetricID', 'ComparisonRiskLabel', 'ActionPolicy',
    'ActionAsOfDate', 'ActionExtractionDate', 'RiskSignalID', 'ActionID'
  ]);
  expect(csv.startsWith('\uFEFF"CSVSchemaVersion","StudyID","SnapshotDate","GroupLevel","GroupID","MetricID"')).toBe(true);
  expect(csv).toContain('"LastAddressed","DaysAgo","ActionedDateSource","ActionDateIsProxy"');
  expect(csv).toContain('"Weight","WeightMax","EffectiveWeight","Counted"');
  expect(csv).toContain('"SnapshotDecisionExcluded","DecisionReason"');
  expect(csv).toContain('"SiteRiskScore","SiteRiskNumerator","SiteRiskDenominator","ComparisonRiskScore","ComparisonRiskNumerator","ComparisonRiskDenominator"');
  expect(csv).toContain('"No Action, ""reviewed""\nwithin window"');
  expect(csv).toContain('"\'=HYPERLINK(""https://example.invalid"")"');
  expect(csv).toContain('"\'  +SUM(1,2)"');
  expect(csv).toContain('"\'@SUM(1,2)"');
  expect(csv).toContain('"\'-formula-like-text"');
  expect(csv).toContain('"00042","00043"');
  expect(csv).toContain('"1001","Analysis_kri0003","KRI 3",0,-2,');
  expect(csv).toContain(',100,8,8,50,4,8,"Analysis_srs0002","Review Priority Score",');
  expect(csv.match(/^2,"TEST-STUDY"/gm)).toHaveLength(9);
  expect(csv).not.toContain('"Analysis_kri0007"');
  expect(csv).not.toContain('"Analysis_kri0004"');
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
    .toHaveCSS('background-color', 'rgb(232, 245, 233)');
  await expect(overview.locator('td.group-overview--recent-action').first())
    .toHaveCSS('box-shadow', 'rgb(45, 164, 78) 0px 0px 0px 3px inset');
  await expect(overview.locator('td.group-overview--recent-action').first())
    .toHaveAttribute('title', /^Score: 1\nKRI 1: 0\.50\nEvents: 1\nParticipants: 2\nLatest action: Closed Action\. Last addressed: 2026-10-15\. Days ago: 20\.$/);
  const actionStyles = () => overview.locator('td.group-overview--recent-action').evaluateAll((cells) =>
    Object.fromEntries(cells.map((cell) => [
      `${cell.__data__.GroupID}:${cell.__data__.MetricID}`,
      { fill: getComputedStyle(cell).backgroundColor, border: getComputedStyle(cell).boxShadow,
        hover: cell.title.split('\n').at(-1),
        accessible: cell.getAttribute('aria-description') }
    ])));
  const expectedActionStyles = {
    '1001:Analysis_kri0001': { fill: 'rgb(232, 245, 233)',
      border: 'rgb(45, 164, 78) 0px 0px 0px 3px inset',
      hover: 'Latest action: Closed Action. Last addressed: 2026-10-15. Days ago: 20.',
      accessible: 'Latest action: Closed Action. Last addressed: 2026-10-15. Days ago: 20.' },
    '1001:Analysis_kri0003': { fill: 'rgb(255, 235, 238)',
      border: 'rgb(207, 34, 46) 0px 0px 0px 3px inset',
      hover: 'Latest action: Open Action. Last addressed: 2026-10-15. Days ago: 20.',
      accessible: 'Latest action: Open Action. Last addressed: 2026-10-15. Days ago: 20.' },
    '1002:Analysis_kri0001': { fill: 'rgb(242, 242, 242)',
      border: 'rgb(102, 102, 102) 0px 0px 0px 3px inset',
      hover: 'Latest action: Awaiting Triage. Last addressed: 2026-10-15. Days ago: 20.',
      accessible: 'Latest action: Awaiting Triage. Last addressed: 2026-10-15. Days ago: 20.' },
    '1002:Analysis_kri0002': { fill: 'rgb(242, 242, 242)',
      border: 'rgb(102, 102, 102) 0px 0px 0px 3px inset',
      hover: 'Latest action: No Action. Last addressed: 2026-08-06. Days ago: 90.',
      accessible: 'Latest action: No Action. Last addressed: 2026-08-06. Days ago: 90.' }
  };
  expect(await actionStyles()).toEqual(expectedActionStyles);
  expect(await overview.locator('td.group-overview--metric').evaluateAll((cells) =>
    cells.filter((cell) => !cell.classList.contains('group-overview--recent-action'))
      .map((cell) => [cell.__data__.GroupID, cell.__data__.MetricID, getComputedStyle(cell).backgroundColor]).sort()
  )).toEqual((await page.evaluate(() => window.actionBorderBackgrounds))
    .filter(([group, metric]) => !expectedBorders.includes(`${group}:${metric}`)));
  expect(await overview.locator('td.group-overview--metric').evaluateAll((cells) =>
    cells.every((cell) => !cell.__data__.tooltipContent || cell.title.startsWith(cell.__data__.tooltipContent))
  )).toBe(true);
  const flags = () => overview.locator('td.group-overview--metric')
    .evaluateAll((cells) => cells.map((cell) => [cell.__data__.GroupID, cell.__data__.MetricID, cell.__data__.Flag]).sort());
  const originalFlags = await flags();
  const baseline = await overview.locator('td.group-overview--siteRiskScore').allTextContents();
  await overview.locator('td.group-overview--comparisonRiskScore').first().click();
  await expect(overview.locator('.group-overview--comparison-detail')).toContainText('2026-10-15');
  expect(await overview.locator('.group-overview--comparison-detail [role="row"]').evaluateAll((rows) =>
    rows.map((row) => row.dataset.metricId)
  )).toEqual(['Analysis_kri0003', 'Analysis_kri0001', 'Analysis_kri0002', 'Analysis_kri0005', 'Analysis_kri0006']);
  await expect(overview.locator('.group-overview--comparison-detail [data-metric-id="Analysis_kri0003"] [role="cell"]').nth(1))
    .toHaveText('-2');
  await expect(overview.locator('.group-overview--comparison-detail [data-metric-id="Analysis_kri0006"] [role="cell"]').nth(2))
    .toHaveText('Not recorded');
  expect(await overview.locator('.group-overview--comparison-detail [role="columnheader"]').allTextContents())
    .toEqual(['KRI', 'Flag', 'Action state', 'Last Addressed', 'Days Ago', 'Counted']);
  expect(await overview.locator('.group-overview--comparison-detail [role="row"]').evaluateAll((rows) =>
    rows.every((row) => row.children.length === 6)
  )).toBe(true);
  expect(await overview.locator('.group-overview--comparison-detail [role="row"]').evaluateAll((rows) =>
    rows.every((row) => {
      const values = [...row.children].map((cell) => cell.textContent);
      const cell = [...row.closest('tbody').querySelectorAll('td.group-overview--metric')].find((candidate) =>
        candidate.__data__.GroupID === '1001' && candidate.__data__.MetricID === row.dataset.metricId);
      return cell && cell.title.split('\n').at(-1) === `Latest action: ${values[2]}. Last addressed: ${values[3]}. Days ago: ${values[4]}.`;
    })
  )).toBe(true);
  await expect(overview.locator('td.group-overview--metric')).toHaveCount(14);
  const detailText = await overview.locator('.group-overview--comparison-detail').innerText();
  await highlightToggle.uncheck();
  expect(await downloadCsv('risk-review-highlight-off.csv')).toBe(csv);
  await expect(overview.locator('td.group-overview--recent-action')).toHaveCount(0);
  expect(await overview.locator('td.group-overview--metric').evaluateAll((cells) =>
    cells.every((cell) => getComputedStyle(cell).boxShadow === 'none')
  )).toBe(true);
  expect(await overview.locator('td.group-overview--metric').evaluateAll((cells) =>
    cells.map((cell) => [cell.__data__.GroupID, cell.__data__.MetricID, getComputedStyle(cell).backgroundColor]).sort()
  )).toEqual(await page.evaluate(() => window.actionBorderBackgrounds));
  expect(await values()).toEqual({ '1001': '50', '1002': '75' });
  expect(await overview.locator('.group-overview--comparison-detail').innerText()).toBe(detailText);
  await overview.getByRole('columnheader', { name: 'Review Priority Score', exact: true }).click();
  await overview.getByRole('columnheader', { name: 'Review Priority Score', exact: true }).click();
  await expect(overview.locator('td.group-overview--comparisonRiskScore').first()).toHaveText('50');
  await page.evaluate(() => window.actionWindowRedraw());
  expect(await downloadCsv('risk-review-redrawn.csv')).toBe(csv);
  expect(await values()).toEqual({ '1001': '50', '1002': '75' });
  await expect(highlightToggle).not.toBeChecked();
  await expect(overview.locator('td.group-overview--recent-action')).toHaveCount(0);
  await highlightToggle.check();
  expect(await borderedCells()).toEqual(expectedBorders);
  expect(await actionStyles()).toEqual(expectedActionStyles);
  await expect(overview.getByRole('columnheader', { name: 'Review Priority Score', exact: true })).toBeVisible();
  expect((await overview.locator('td.group-overview--siteRiskScore').allTextContents()).sort())
    .toEqual(baseline.sort());
  expect(await flags()).toEqual(originalFlags);
  await overview.screenshot({ path: test.info().outputPath('action-window-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(highlightToggle).toBeVisible();
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
