# Proxy for server-side updates to a rendered bars widget

Verbs map 1:1 to `chart.helpers`. Selection verbs pass `_silent` by
default so server-driven updates do not echo select events back to the
server (no feedback loops). `proxy_update_data()` without a spec reuses
the live browser-side spec (`chart.data._spec_`) — the R side never
re-pushes a cached spec over toggle-mutated state.

## Usage

``` r
bars_proxy(id, session = shiny::getDefaultReactiveDomain())

proxy_update_data(proxy, data, spec = NULL)

proxy_update_spec(proxy, spec)

proxy_select_category(proxy, values, silent = TRUE)

proxy_select_segment(proxy, values, silent = TRUE)

proxy_clear_selection(proxy, silent = TRUE)

proxy_export_image(proxy, filename = NULL)
```

## Arguments

- id:

  `character(1)` The widget's Shiny output id.

- session:

  The Shiny session.

- proxy:

  A `gsm_vizr_proxy` from `bars_proxy()`.

- data, spec, values, silent, filename:

  Verb arguments; see Details.

## Value

A `gsm_vizr_proxy`; verbs return it invisibly for piping.

## Details

Proxy verbs target
[`bars()`](https://gilead-public.github.io/gsm.vizr/dev/reference/bars.md)
widgets only in 0.1.0. A verb aimed at a
[`facet_bars()`](https://gilead-public.github.io/gsm.vizr/dev/reference/facet_bars.md)
widget raises a browser-side error naming the widget and the verb rather
than silently doing nothing.
