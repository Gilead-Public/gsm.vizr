# Changelog

## gsm.vizr 0.1.0

Initial release: htmlwidgets wrapper for the gsm.viz 2.4.1
`bars`/`facetBars` renderers.

- [`bars()`](https://gilead-public.github.io/gsm.vizr/dev/reference/bars.md)/[`facet_bars()`](https://gilead-public.github.io/gsm.vizr/dev/reference/facet_bars.md)
  widgets over one vendored bundle.
- [`bars_spec()`](https://gilead-public.github.io/gsm.vizr/dev/reference/bars_spec.md)/[`facet_spec()`](https://gilead-public.github.io/gsm.vizr/dev/reference/facet_spec.md)
  validation mirroring gsm.viz `validateSpec.js`; factor levels derive
  category/stack order automatically.
- [`js_hook()`](https://gilead-public.github.io/gsm.vizr/dev/reference/js_hook.md)
  for function-valued slots, revived on an allowlist only.
- `gsm-viz-select` event contract with Shiny input mirroring.
- [`barsOutput()`](https://gilead-public.github.io/gsm.vizr/dev/reference/bars-shiny.md)/[`renderBars()`](https://gilead-public.github.io/gsm.vizr/dev/reference/bars-shiny.md)/[`bars_proxy()`](https://gilead-public.github.io/gsm.vizr/dev/reference/bars_proxy.md)
  verbs (silent by default).
- [`html_dependency_gsm_viz()`](https://gilead-public.github.io/gsm.vizr/dev/reference/html_dependency_gsm_viz.md)
  for other packages’ custom widgets.

### Things to know

`datum` in a `gsm-viz-select` detail follows the chart’s `stat`: the
single contributing row under `"identity"`, the array of aggregated rows
under `"count"`. It is forwarded from gsm.viz unchanged, so consumers
must branch on the mode they built the chart with.

Authoring `position = "fill"` and authoring `stat = "percent"` produce
the same chart; gsm.viz normalizes the former into the latter.

`minHeight` is a floor and `theme$pxPerCategory` is the growth rate
under `theme$dynamicSizing`. Set both to reproduce a caller’s own
`max(base, per * n)` sizing curve.

For reports without Shiny, drive a rendered chart through
`el.gsmChart.helpers` (`updateData`, `selectCategory`, `clearSelection`,
…) from report JavaScript;
[`bars_proxy()`](https://gilead-public.github.io/gsm.vizr/dev/reference/bars_proxy.md)
and its verbs require a Shiny session.

### Known limitations

Upstream gsm.viz asks are drafted for these; none is shimmed here.

- Zero-value bars are not clickable or hoverable.
- Outside total labels may clip near the axis maximum.
- Empty data renders gracefully but without a placeholder message.
- `legend` accepts only `dense` — there is no legend position or
  orientation key.
- Proxy verbs apply to
  [`bars()`](https://gilead-public.github.io/gsm.vizr/dev/reference/bars.md)
  widgets only. A verb aimed at a
  [`facet_bars()`](https://gilead-public.github.io/gsm.vizr/dev/reference/facet_bars.md)
  widget raises an error rather than updating the panels, because
  upstream does not define per-panel semantics for the selection
  helpers.
