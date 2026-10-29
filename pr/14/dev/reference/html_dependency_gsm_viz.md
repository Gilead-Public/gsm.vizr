# HTML dependency for the vendored gsm.viz bundle

For custom widgets built outside this package: declare this dependency
instead of vendoring the bundle again. Loading it defines
`window.gsmViz`.

## Usage

``` r
html_dependency_gsm_viz()
```

## Value

An
[`htmltools::htmlDependency()`](https://rstudio.github.io/htmltools/reference/htmlDependency.html).
