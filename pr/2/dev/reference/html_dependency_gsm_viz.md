# HTML dependency for the vendored gsm.viz bundle

For other packages' custom widgets (e.g. the gsm.kri premature-death
widgets): declare this dependency instead of vendoring the bundle again.
Loading it defines `window.gsmViz`.

## Usage

``` r
html_dependency_gsm_viz()
```

## Value

An
[`htmltools::htmlDependency()`](https://rstudio.github.io/htmltools/reference/htmlDependency.html).
