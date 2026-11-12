# gsm.vizr

An htmlwidgets interface to the [gsm.viz](https://github.com/Gilead-Public/gsm.viz)
JavaScript library's generic `bars` and `facetBars` renderers. It provides spec
construction and validation, a stable R-to-JavaScript serialization contract,
click and selection events, Shiny bindings with proxy update verbs, and a shared
HTML dependency for other packages' custom widgets.

One package vendors the gsm.viz bundle once. Report packages add a single
dependency instead of each carrying their own copy of the widget JavaScript,
YAML and serialization glue.

## Installation

```r
# Latest release
pak::pak("Gilead-Public/gsm.vizr@v0.1.0")

# Development build
pak::pak("Gilead-Public/gsm.vizr@dev")
```

Always give the ref. A bare `pak::pak("Gilead-Public/gsm.vizr")` resolves to
whatever the repository's default branch currently holds, which is not
necessarily the release.

## Usage

```r
library(gsm.vizr)

dfSites <- data.frame(
  site = rep(c("S-001", "S-002", "S-003"), times = c(5, 3, 2)),
  flag = rep(c("2", "1", "2", "1", "0"), times = 2)
)

bars(dfSites, bars_spec(x = "site", fill = "flag"))
```

Arguments map 1:1 onto the gsm.viz spec, so gsm.viz's documentation remains the
source of truth for what each key does. `bars_spec()` validates in R using the
same messages as gsm.viz's own validator, so a malformed spec fails before it
reaches a browser.

See `vignette("gsm-vizr")` for the event contract, the Shiny proxy verbs, and
how to drive a chart from a report that has no Shiny session.

## Review CSV

`Widget_GroupOverview()` provides **Download CSV** when comparison-risk detail
is supplied. It exports one row per review entry across all supplied sites,
not just the expanded site or currently filtered table. Dated exports use the
same inclusive 90-day flagged-or-addressed selection and ordering as the
drilldown; legacy exports include nonzero flags. Sites sort naturally by ID,
then rows sort by latest addressed date, absolute review flag, and KRI ID.
The export never recalculates scores or changes highlighting.

Schema version 2 uses these ordered column groups:

| Group | Columns |
| --- | --- |
| Context | `CSVSchemaVersion`, `StudyID`, `SnapshotDate`, `GroupLevel`, `GroupID`, `MetricID`, `MetricLabel` |
| Flags | `CurrentFlag`, `ReviewFlag`, `LastFlaggedDate`, `DaysSinceFlag` |
| Action | `ActionState`, `ActionedFlag`, `LastAddressed`, `DaysAgo`, `ActionedDateSource`, `ActionDateIsProxy`, `ActionWindowDays` |
| Contribution | `Weight`, `WeightMax`, `EffectiveWeight`, `Counted`, `ActionFactor` |
| Decision | `SnapshotDecisionExcluded`, `DecisionReason`, `DecisionCoversFinding` |
| Reported scores | `SiteRiskScore`, `SiteRiskNumerator`, `SiteRiskDenominator`, `ComparisonRiskScore`, `ComparisonRiskNumerator`, `ComparisonRiskDenominator`, `ComparisonRiskMetricID`, `ComparisonRiskLabel` |
| Provenance | `ActionPolicy`, `ActionAsOfDate`, `ActionExtractionDate`, `RiskSignalID`, `ActionID` |

The primary key is `(StudyID, SnapshotDate, GroupLevel, GroupID, MetricID)` for
standard per-KRI detail. `CurrentFlag` is the matrix flag; `ReviewFlag` is the
drilldown's historical/reviewed flag. `Counted` uses the same Yes/No/Partly/Not
weighted labels as the drilldown. Scores and their components are copied at
full precision and repeated per review row; the exported row set is not a new
denominator. Proxy dates remain distinguishable from verified dates.

The file is UTF-8 with a BOM, a header row, CRLF records, ISO `YYYY-MM-DD` dates,
plain numeric values, and `true`/`false` booleans. Missing values are empty.
Text is quoted with embedded quotes doubled; spreadsheet-formula-like text
is prefixed with an apostrophe. Identifier fields are strings, so import them
as text to preserve leading zeros. Filenames follow
`risk-review_<StudyID>_<assessment-date>.csv` when that context is available.
Downloads are generated locally in the browser; no data is uploaded.

## For package authors

If your package ships its own custom widget that needs `window.gsmViz`, declare
the shared dependency rather than vendoring a second copy of the bundle:

```r
htmltools::attachDependencies(myWidgetTags, gsm.vizr::html_dependency_gsm_viz())
```

Upgrading the bundle is then one change in one place, and every consumer moves
together.
