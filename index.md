# gsm.vizr

An htmlwidgets interface to the
[gsm.viz](https://github.com/Gilead-Public/gsm.viz) JavaScript library’s
generic `bars` and `facetBars` renderers. It provides spec construction
and validation, a stable R-to-JavaScript serialization contract, click
and selection events, Shiny bindings with proxy update verbs, and a
shared HTML dependency for other packages’ custom widgets.

One package vendors the gsm.viz bundle once. Report packages add a
single dependency instead of each carrying their own copy of the widget
JavaScript, YAML and serialization glue.

## Installation

``` r

# Latest release
pak::pak("Gilead-Public/gsm.vizr@v0.1.0")

# Development build
pak::pak("Gilead-Public/gsm.vizr@dev")
```

Always give the ref. A bare `pak::pak("Gilead-Public/gsm.vizr")`
resolves to whatever the repository’s default branch currently holds,
which is not necessarily the release.

## Usage

``` r

library(gsm.vizr)

dfSites <- data.frame(
  site = rep(c("S-001", "S-002", "S-003"), times = c(5, 3, 2)),
  flag = rep(c("2", "1", "2", "1", "0"), times = 2)
)

bars(dfSites, bars_spec(x = "site", fill = "flag"))
```

Arguments map 1:1 onto the gsm.viz spec, so gsm.viz’s documentation
remains the source of truth for what each key does.
[`bars_spec()`](https://gilead-public.github.io/gsm.vizr/reference/bars_spec.md)
validates in R using the same messages as gsm.viz’s own validator, so a
malformed spec fails before it reaches a browser.

See
[`vignette("gsm-vizr")`](https://gilead-public.github.io/gsm.vizr/articles/gsm-vizr.md)
for the event contract, the Shiny proxy verbs, and how to drive a chart
from a report that has no Shiny session.

## For package authors

If your package ships its own custom widget that needs `window.gsmViz`,
declare the shared dependency rather than vendoring a second copy of the
bundle:

``` r

htmltools::attachDependencies(myWidgetTags, gsm.vizr::html_dependency_gsm_viz())
```

Upgrading the bundle is then one change in one place, and every consumer
moves together.
