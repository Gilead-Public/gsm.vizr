# gsm.vizr 0.1.0

Initial release: an htmlwidgets interface to the gsm.viz JavaScript library,
hosting both of its chart generations against one vendored gsm.viz 2.4.1 bundle.

* `bars()`/`facet_bars()` widgets over one vendored bundle.
* `bars_spec()`/`facet_spec()` validation mirroring gsm.viz `validateSpec.js`;
  factor levels derive category/stack order automatically.
* `js_hook()` for function-valued slots, revived on an allowlist only.
* `gsm-viz-select` event contract with Shiny input mirroring.
* `barsOutput()`/`renderBars()`/`bars_proxy()` verbs (silent by default).
* `html_dependency_gsm_viz()` for other packages' custom widgets.
* Relocated the legacy KRI widget wrappers from gsm.kri (#4): `Widget_BarChart`,
  `Widget_ScatterPlot`, `Widget_TimeSeries`, `Widget_GroupOverview`, their Shiny
  bindings, `MakeChartConfig()`, and the shared widget-control JS/CSS.
* Takes gsm.core (>= 1.3.1) in Imports, alongside dplyr, fontawesome, lifecycle,
  magrittr, purrr, rlang, and tidyr.

## Things to know

The vendored bundle is the gsm.viz 2.4.1 tag plus one patch carried over from
gsm.kri#285, which points `SiteRiskScoreURL` at `gilead-public.github.io` instead
of the pre-rename `gilead-biostats.github.io`. It is therefore not a clean build
of the tag: a bundle bump must either re-apply the substitution or land on an
upstream gsm.viz release that already carries it, otherwise the SiteRiskScore
help link in KRI reports silently regresses.

`datum` in a `gsm-viz-select` detail follows the chart's `stat`: the single
contributing row under `"identity"`, the array of aggregated rows under
`"count"`. It is forwarded from gsm.viz unchanged, so consumers must branch on
the mode they built the chart with.

Authoring `position = "fill"` and authoring `stat = "percent"` produce the same
chart; gsm.viz normalizes the former into the latter.

`minHeight` is a floor and `theme$pxPerCategory` is the growth rate under
`theme$dynamicSizing`. Set both to reproduce a caller's own `max(base, per * n)`
sizing curve.

For reports without Shiny, drive a rendered chart through
`el.gsmChart.helpers` (`updateData`, `selectCategory`, `clearSelection`, …)
from report JavaScript; `bars_proxy()` and its verbs require a Shiny session.

## Known limitations

Upstream gsm.viz asks are drafted for these; none is shimmed here.

* Zero-value bars are not clickable or hoverable.
* Outside total labels may clip near the axis maximum.
* Empty data renders gracefully but without a placeholder message.
* `legend` accepts only `dense` — there is no legend position or orientation key.
* Proxy verbs apply to `bars()` widgets only. A verb aimed at a `facet_bars()`
  widget raises an error rather than updating the panels, because upstream does
  not define per-panel semantics for the selection helpers.
