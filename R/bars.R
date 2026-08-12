#' Render a gsm.viz bars chart
#'
#' Thin htmlwidget over `gsmViz.default.bars`. `spec` maps 1:1 to the
#' JS spec (see `bars_spec()`); gsm.viz's documentation is the source of
#' truth for its keys.
#'
#' @param data `data.frame` Long rows; one row per observation (`stat = "count"`)
#'   or one row per category/segment (`stat = "identity"`).
#' @param spec `list` Chart specification, typically from `bars_spec()`.
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

  payload <- list(
    data = .vizr_json(data),
    spec = .vizr_json(spec),
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
