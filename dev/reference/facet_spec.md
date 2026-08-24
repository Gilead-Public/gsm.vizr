# Build a facetBars facet configuration

Keys map 1:1 to gsm.viz `spec.facet` (field, order, nCol, chartHeight,
label, scales, legend).

## Usage

``` r
facet_spec(
  field,
  order = NULL,
  nCol = NULL,
  chartHeight = NULL,
  label = NULL,
  scales = NULL,
  legend = NULL
)
```

## Arguments

- field:

  `character(1)` Column to facet by. Required.

- order, nCol, chartHeight, label, scales, legend:

  Passed through 1:1.

## Value

A plain list for
[`facet_bars()`](https://gilead-public.github.io/gsm.vizr/dev/reference/facet_bars.md).
