# Render a gsm.viz tiles heatmap

Thin htmlwidget over `gsmViz.default.tiles`, an HTML-table heatmap with
one row per `y` value, one column per `x` value, and optional in-place
expandable columns. `spec` maps 1:1 to the JS spec; gsm.viz's `tiles`
documentation is the source of truth for its keys.

## Usage

``` r
tiles(
  data,
  spec,
  metadata = list(),
  width = NULL,
  height = NULL,
  elementId = NULL,
  bDebug = FALSE
)
```

## Arguments

- data:

  `data.frame` One row per (row, column) cell.

- spec:

  `list` Chart specification. `spec$mapping$x` and `spec$mapping$y` are
  required and must name columns of `data`. When `spec$expand` is set,
  `spec$expand$data` must be a `data.frame` holding the `mapping$x`,
  `mapping$y` and `expand$mapping$x` columns.

- metadata:

  `list` Named list of report keys (e.g. `chartId`) echoed in event
  payloads. `chartId` also becomes the widget element's id outside
  Shiny.

- width, height, elementId:

  Standard htmlwidgets arguments.

- bDebug:

  `logical` Log the payload to the browser console.

## Value

A `tiles` htmlwidget.

## Details

`data` and `spec$expand$data` travel column-wise (one JSON array per
column) and are rebuilt into row objects in the browser, which keeps
large detail tables a fraction of their rows-wise size. `NA` arrives as
`null`.

Every interaction dispatches a bubbling `gsm-viz-select` `CustomEvent`
on the widget element, then runs any user
[`js_hook()`](https://gilead-public.github.io/gsm.vizr/dev/reference/js_hook.md)
callback (called with `this` set to the widget element). Event `detail`
shapes:

- cell click: `{type: "click", chartId, datum, metadata}`

- row header click: `{type: "rowclick", chartId, y, rows, metadata}`

- column expand/collapse:
  `{type: "expand", chartId, x, expanded, metadata}`

Row header clicks do not select the row; call
`el.gsmChart.helpers.selectRow(el.gsmChart, y)` to do so. The chart
object is stored on the widget element as `el.gsmChart` and the metadata
as `el.gsmMeta`.

## Examples

``` r
df <- data.frame(
  subjid = c("P1", "P1", "P2"),
  vital = c("Pulse", "SBP", "Pulse"),
  flag = c("Red", "Green", "Amber")
)
tiles(
  df,
  list(
    mapping = list(x = "vital", y = "subjid", fill = "flag"),
    scales = list(
      fill = list(colors = list(Green = "#3DAF06", Amber = "#FEAA02", Red = "#FF5859"))
    )
  )
)

{"x":{"data":{"subjid":["P1","P1","P2"],"vital":["Pulse","SBP","Pulse"],"flag":["Red","Green","Amber"]},"spec":{"mapping":{"x":"vital","y":"subjid","fill":"flag"},"scales":{"fill":{"colors":{"Green":"#3DAF06","Amber":"#FEAA02","Red":"#FF5859"}}}},"expandData":null,"jsHooks":[],"metadata":{},"bDebug":false},"evals":[],"jsHooks":[]}
```
