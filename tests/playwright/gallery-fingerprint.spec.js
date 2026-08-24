const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const GALLERY = 'file://' + path.resolve(__dirname, 'fixture', 'gallery.html');
const BASELINE = path.join(__dirname, 'gallery-baseline.json');

// The gallery is the design's shape-matrix traceability proof, so the set of
// charts is an assertion — not whatever happened to render. Task 16 appends
// its ids to this list.
const EXPECTED_CHARTS = [
  'chart-basic',
  'chart-singleton',
  'chart-facet',
  'chart-hooks',
  'chart-select',
  'chart-select-identity',
  'chart-dynamic',
  'chart-hbar-stack',
  'chart-dodge',
  'chart-fill100',
  'chart-percent',
  'chart-identity',
  'chart-sort-total',
  'chart-topn',
  'chart-seg-labels',
  'chart-tooltip-format',
  'chart-reflines',
  'chart-zoom',
  'chart-dense-legend',
  'chart-multi-select',
  // Task 16 pages (chart-facet is already listed above — it landed at Task 7):
  'chart-qtl-replica',
  'chart-endpoints-replica',
  'chart-pd-dependency',
  'chart-empty',
  'chart-static-helpers',
  'chart-qtl-identity',
  'chart-outside-labels',
  'chart-dynamic-many',
];

// Structural fingerprint per chart: category labels, dataset shapes, axis
// orientation, plus the spec dimensions those cannot reveal (a dodge and a
// stack chart of the same data have identical labels and datasets).
// Deliberately no pixels — portable across chromium versions.
async function fingerprints(page) {
  await page.goto(GALLERY);
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.gsm-vizr'))
      .map((el) => {
        if (el.gsmFacet) {
          return { id: el.id, facets: el.gsmFacet.charts.length };
        }
        const ch = el.gsmChart;
        const s = ch.data._spec_ || {};
        return {
          id: el.id,
          labels: ch.data.labels,
          indexAxis: ch.options.indexAxis,
          position: s.position || null,
          stat: s.stat || null,
          nCategories: s.nCategories || null,
          zoom: !!(s.zoom && s.zoom.enabled),
          denseLegend: !!(s.legend && s.legend.dense),
          selection: s.selection
            ? { enabled: !!s.selection.enabled, multiple: !!s.selection.multiple }
            : null,
          captions:
            s.labels && s.labels.captions ? [].concat(s.labels.captions).length : 0,
          // Chart and axis titles are supported spec keys (labels.title,
          // scales.x/y.label) that every downstream consumer sets.
          title: (s.labels && s.labels.title) || null,
          xLabel: (s.scales && s.scales.x && s.scales.x.label) || null,
          yLabel: (s.scales && s.scales.y && s.scales.y.label) || null,
          datasets: ch.data.datasets.map((d) => ({
            label: d.label === undefined ? null : d.label,
            n: d.data.length,
          })),
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id))
  );
}

test('gallery renders exactly the expected chart set', async ({ page }) => {
  const ids = (await fingerprints(page)).map((f) => f.id).sort();
  expect(ids).toEqual([...EXPECTED_CHARTS].sort());
});

test('key charts carry their distinguishing spec features', async ({ page }) => {
  const byId = Object.fromEntries((await fingerprints(page)).map((f) => [f.id, f]));
  expect(byId['chart-dodge'].position).toBe('dodge');

  // Upstream normalizes position "fill" into its canonical internal form,
  // {position: "stack", stat: "percent"} — the same state positionToggle
  // produces when a user picks "fill". _spec_ therefore holds the effective
  // spec, not the authored one, and asserting position === 'fill' would be
  // asserting a value the renderer never stores. The consequence worth pinning:
  // authoring position = "fill" and authoring stat = "percent" produce
  // identical charts, so these two matrix cells converge by design.
  expect(byId['chart-fill100'].position).toBe('stack');
  expect(byId['chart-fill100'].stat).toBe('percent');
  expect(byId['chart-percent'].position).toBe('stack');
  expect(byId['chart-percent'].stat).toBe('percent');
  expect(byId['chart-topn'].nCategories).toBe(3);
  expect(byId['chart-topn'].labels).toHaveLength(3);
  expect(byId['chart-zoom'].zoom).toBe(true);
  expect(byId['chart-dense-legend'].denseLegend).toBe(true);
  expect(byId['chart-multi-select'].selection).toEqual({
    enabled: true,
    multiple: true,
  });
  expect(byId['chart-hbar-stack'].indexAxis).toBe('y');
  expect(byId['chart-hbar-stack'].captions).toBe(2);
});

test('gallery structural fingerprints match the committed baseline', async ({ page }) => {
  const current = await fingerprints(page);
  // Manifest gate runs BEFORE capture: a baseline can never bless a gallery
  // that lost a chart.
  expect(current.map((f) => f.id).sort()).toEqual([...EXPECTED_CHARTS].sort());
  if (process.env.CAPTURE_BASELINE) {
    fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
    console.log('Baseline captured:', BASELINE);
    return;
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  expect(current).toEqual(baseline);
});
