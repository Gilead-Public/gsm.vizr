# Build and validate a gsm.viz bars spec

Faithful 1:1 construction of the JS spec object: arguments map to
top-level spec keys, aesthetics nest under `mapping`. Validation mirrors
gsm.viz `src/bars/validateSpec.js` (same messages), so invalid specs
fail in R before reaching the browser. JSON-safe features
(`tooltip$format`, label templates) are the documented first choice;
[`js_hook()`](https://gilead-public.github.io/gsm.vizr/reference/js_hook.md)
is the escape hatch for function-valued slots.

## Usage

``` r
bars_spec(
  x,
  y = NULL,
  fill = NULL,
  orientation = "vertical",
  position = "stack",
  stat = NULL,
  nCategories = NULL,
  scales = NULL,
  labels = NULL,
  annotations = NULL,
  tooltip = NULL,
  callbacks = NULL,
  selection = NULL,
  theme = NULL,
  zoom = NULL,
  legend = NULL,
  interactive = TRUE
)
```

## Arguments

- x, y, fill:

  `character(1)` Column names for the aesthetics; `x` required.

- orientation:

  `"vertical"` or `"horizontal"`.

- position:

  One of `"stack"`, `"dodge"`, `"identity"`, `"fill"`, `"layer"`.

- stat:

  One of `"count"`, `"identity"`, `"percent"` (gsm.viz default: count).

- nCategories:

  `integer(1)` Top-N category cap.

- scales, labels, annotations, tooltip, callbacks, selection, theme,
  zoom, legend:

  `list` Passed through 1:1; see the gsm.viz bars documentation.

- interactive:

  `logical(1)` gsm.viz `interactive` flag.

## Value

A plain list ready for
[`bars()`](https://gilead-public.github.io/gsm.vizr/reference/bars.md).
