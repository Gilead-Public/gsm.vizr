# Shiny bindings for bars

`height` and the `minHeight` of the widget it renders apply to the same
container, and `minHeight` is a floor, so it wins. The default here
matches
[`bars()`](https://gilead-public.github.io/gsm.vizr/dev/reference/bars.md)'s
default `minHeight` for that reason. To render an output shorter than
500px, lower both — `barsOutput(height = "300px")` alone stays 500px
tall until the widget is built with `bars(..., minHeight = 300)`.

## Usage

``` r
barsOutput(outputId, width = "100%", height = "500px")

renderBars(expr, env = parent.frame(), quoted = FALSE)
```

## Arguments

- outputId, width, height, expr, env, quoted:

  Standard htmlwidgets Shiny binding parameters.

## Value

`barsOutput()` returns a Shiny output element; `renderBars()` returns a
render function for that output.

## Details

A `metadata$chartId` is ignored under Shiny: the output id is what the
proxy verbs and `input$<id>_click` / `input$<id>_select` are keyed on,
so the binding keeps it and warns instead of renaming the element.
