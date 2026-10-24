# Shiny bindings for tiles

Interactions are mirrored to Shiny inputs keyed on the output id:
`input$<id>_click`, `input$<id>_rowclick` and `input$<id>_expand`, each
carrying the same `detail` as the `gsm-viz-select` event (see
[`tiles()`](https://gilead-public.github.io/gsm.vizr/dev/reference/tiles.md)).
A `metadata$chartId` is ignored under Shiny so those input names stay
keyed on the output id; the binding warns instead of renaming the
element.

## Usage

``` r
tilesOutput(outputId, width = "100%", height = "auto")

renderTiles(expr, env = parent.frame(), quoted = FALSE)
```

## Arguments

- outputId, width, height, expr, env, quoted:

  Standard htmlwidgets Shiny binding parameters.

## Value

`tilesOutput()` returns a Shiny output element; `renderTiles()` returns
a render function for that output.

## Details

The default `height = "auto"` lets the grid size itself; its scroll
height is set by the spec's `theme$maxHeight`.
