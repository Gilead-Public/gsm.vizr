#' Render a gsm.viz bars chart
#'
#' Thin htmlwidget over `gsmViz.default.bars`. `spec` maps 1:1 to the
#' JS spec (see `bars_spec()`); gsm.viz's documentation is the source of
#' truth for its keys.
#'
#' @param data `data.frame` Long rows; one row per observation (`stat = "count"`)
#'   or one row per category/segment (`stat = "identity"`).
#' @param spec `list` Chart specification, typically from [bars_spec()].
#' @param metadata `list` Named list of report keys (e.g. `chartId`) echoed in
#'   event payloads. Not a data.frame — event consumers expect a JSON object.
#' @param width,height,elementId Standard htmlwidgets arguments.
#' @param minHeight `numeric` Minimum widget height in pixels; applied as a
#'   CSS floor so `theme$dynamicSizing` cannot collapse small charts. Default 500.
#' @param bDebug `logical` Log the payload to the browser console.
#' @return A `bars` htmlwidget.
#' @export
bars <- function(
  data,
  spec,
  metadata = list(),
  width = NULL,
  height = NULL,
  elementId = NULL,
  minHeight = 500,
  bDebug = FALSE
) {
  if (!is.data.frame(data)) {
    stop("data must be a data.frame", call. = FALSE)
  }
  if (!is.list(spec) || is.data.frame(spec)) {
    stop("spec must be a list", call. = FALSE)
  }
  # data.frames pass is.list(), and one serialized rows-wise would reach the
  # browser as an array where every event consumer expects an object.
  if (!is.list(metadata) || is.data.frame(metadata)) {
    stop("metadata must be a list", call. = FALSE)
  }

  # Validation, order derivation and array normalization all live here so a spec
  # sent later by the proxy verbs is treated identically to this first render.
  prepared <- .prepare_spec(spec, data = data)

  payload <- list(
    data = .vizr_json(data),
    spec = .vizr_json(prepared$spec),
    metadata = .vizr_json(metadata),
    minHeight = minHeight,
    bDebug = isTRUE(bDebug)
  )

  htmlwidgets::createWidget(
    name = "bars",
    x = payload,
    width = width,
    height = height,
    elementId = elementId,
    package = "gsm.vizr",
    sizingPolicy = htmlwidgets::sizingPolicy(
      defaultWidth = "100%",
      knitr.figure = FALSE,
      knitr.defaultWidth = "100%"
    )
  )
}

#' Render a faceted set of gsm.viz bars charts
#'
#' Thin htmlwidget over `gsmViz.default.facetBars` — one sub-chart per
#' unique value of the facet field, in a shared grid with linked hover.
#' @inheritParams bars
#' @param facet `list` Facet configuration from [facet_spec()].
#' @return A `bars` htmlwidget rendering via facetBars.
#' @export
facet_bars <- function(
  data,
  spec,
  facet,
  metadata = list(),
  width = NULL,
  height = NULL,
  elementId = NULL,
  minHeight = 500,
  bDebug = FALSE
) {
  # facetBars delegates to the bars validator and then adds this; checking it
  # before bars() means the message names the real problem rather than surfacing
  # as a malformed order object in the browser.
  .check_order_array_or_function(
    .pluck(spec, "scales", "x", "order"),
    "spec.scales.x.order"
  )
  w <- bars(
    data,
    spec,
    metadata = metadata,
    width = width,
    height = height,
    elementId = elementId,
    minHeight = minHeight,
    bDebug = bDebug
  )
  w$x$facet <- .vizr_json(.prepare_facet(facet))
  w
}
