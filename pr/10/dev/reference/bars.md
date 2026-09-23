# Render a gsm.viz bars chart

Thin htmlwidget over `gsmViz.default.bars`. `spec` maps 1:1 to the JS
spec (see
[`bars_spec()`](https://gilead-public.github.io/gsm.vizr/dev/reference/bars_spec.md));
gsm.viz's documentation is the source of truth for its keys.

## Usage

``` r
bars(
  data,
  spec,
  metadata = list(),
  width = NULL,
  height = NULL,
  elementId = NULL,
  minHeight = 500,
  bDebug = FALSE
)
```

## Arguments

- data:

  `data.frame` Long rows; one row per observation (`stat = "count"`) or
  one row per category/segment (`stat = "identity"`).

- spec:

  `list` Chart specification, typically from
  [`bars_spec()`](https://gilead-public.github.io/gsm.vizr/dev/reference/bars_spec.md).

- metadata:

  `list` Named list of report keys (e.g. `chartId`) echoed in event
  payloads. Not a data.frame — event consumers expect a JSON object.

- width, height, elementId:

  Standard htmlwidgets arguments.

- minHeight:

  `numeric` Minimum widget height in pixels; applied as a CSS floor so
  `theme$dynamicSizing` cannot collapse small charts. Default 500.

- bDebug:

  `logical` Log the payload to the browser console.

## Value

A `bars` htmlwidget.
