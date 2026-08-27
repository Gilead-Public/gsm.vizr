# Mark a spec slot as literal JavaScript

Alias for
[`htmlwidgets::JS()`](https://rdrr.io/pkg/htmlwidgets/man/JS.html). Only
the function-valued gsm.viz slots are revived in the browser:
`tooltip$formatter`, `callbacks$onClick`, `callbacks$onHover`,
`callbacks$onSelect`, the two annotation label formatters, and
`scales$x$order`. Anywhere else,
[`bars()`](https://gilead-public.github.io/gsm.vizr/reference/bars.md)
errors. Prefer the JSON-safe alternatives (`tooltip$format`, label
`format` strings) where they suffice.

## Usage

``` r
js_hook(...)
```

## Arguments

- ...:

  Character strings of JavaScript, concatenated by newlines.

## Value

A `JS_EVAL` string, as returned by
[`htmlwidgets::JS()`](https://rdrr.io/pkg/htmlwidgets/man/JS.html).

## Details

A function-valued `scales$x$order` is a
[`facet_bars()`](https://gilead-public.github.io/gsm.vizr/reference/facet_bars.md)
feature: facetBars calls it once per facet as
`order(facetValue, facetData)` to order that facet's categories. Plain
[`bars()`](https://gilead-public.github.io/gsm.vizr/reference/bars.md)
hands the slot to gsm.viz, which expects an array there and has no
function branch.
