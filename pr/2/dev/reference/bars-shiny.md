# Shiny bindings for bars

Shiny bindings for bars

## Usage

``` r
barsOutput(outputId, width = "100%", height = "400px")

renderBars(expr, env = parent.frame(), quoted = FALSE)
```

## Arguments

- outputId, width, height, expr, env, quoted:

  Standard htmlwidgets Shiny binding parameters.

## Value

`barsOutput()` returns a Shiny output element; `renderBars()` returns a
render function for that output.
