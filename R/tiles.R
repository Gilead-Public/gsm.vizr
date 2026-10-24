#' Render a gsm.viz tiles heatmap
#'
#' Thin htmlwidget over `gsmViz.default.tiles`, an HTML-table heatmap with one
#' row per `y` value, one column per `x` value, and optional in-place
#' expandable columns. `spec` maps 1:1 to the JS spec; gsm.viz's `tiles`
#' documentation is the source of truth for its keys.
#'
#' `data` and `spec$expand$data` travel column-wise (one JSON array per
#' column) and are rebuilt into row objects in the browser, which keeps large
#' detail tables a fraction of their rows-wise size. `NA` arrives as `null`.
#'
#' Every interaction dispatches a bubbling `gsm-viz-select` `CustomEvent` on
#' the widget element, then runs any user [js_hook()] callback (called with
#' `this` set to the widget element). Event `detail` shapes:
#' * cell click: `{type: "click", chartId, datum, metadata}`
#' * row header click: `{type: "rowclick", chartId, y, rows, metadata}`
#' * column expand/collapse: `{type: "expand", chartId, x, expanded, metadata}`
#'
#' Row header clicks do not select the row; call
#' `el.gsmChart.helpers.selectRow(el.gsmChart, y)` to do so. The chart object
#' is stored on the widget element as `el.gsmChart` and the metadata as
#' `el.gsmMeta`.
#'
#' @param data `data.frame` One row per (row, column) cell.
#' @param spec `list` Chart specification. `spec$mapping$x` and
#'   `spec$mapping$y` are required and must name columns of `data`. When
#'   `spec$expand` is set, `spec$expand$data` must be a `data.frame` holding
#'   the `mapping$x`, `mapping$y` and `expand$mapping$x` columns.
#' @param metadata `list` Named list of report keys (e.g. `chartId`) echoed in
#'   event payloads. `chartId` also becomes the widget element's id outside
#'   Shiny.
#' @param width,height,elementId Standard htmlwidgets arguments.
#' @param bDebug `logical` Log the payload to the browser console.
#' @return A `tiles` htmlwidget.
#' @examples
#' df <- data.frame(
#'   subjid = c("P1", "P1", "P2"),
#'   vital = c("Pulse", "SBP", "Pulse"),
#'   flag = c("Red", "Green", "Amber")
#' )
#' tiles(
#'   df,
#'   list(
#'     mapping = list(x = "vital", y = "subjid", fill = "flag"),
#'     scales = list(
#'       fill = list(colors = list(Green = "#3DAF06", Amber = "#FEAA02", Red = "#FF5859"))
#'     )
#'   )
#' )
#' @export
tiles <- function(
  data,
  spec,
  metadata = list(),
  width = NULL,
  height = NULL,
  elementId = NULL,
  bDebug = FALSE
) {
  if (!is.data.frame(data)) {
    stop("data must be a data.frame", call. = FALSE)
  }
  if (!is.list(spec) || is.data.frame(spec)) {
    stop("spec must be a list", call. = FALSE)
  }
  metadata <- .prepare_metadata(metadata)
  .validate_tiles_spec(spec, data)

  # expand$data travels in its own column-wise slot; the rest of the spec is
  # serialized exactly as bars() serializes its spec.
  expand_data <- .pluck(spec, "expand", "data")
  if (!is.null(spec$expand)) {
    spec$expand$data <- NULL
  }
  spec <- .normalize_tiles_arrays(spec)
  hooks <- .extract_js_hooks(spec, slots = .TILES_JS_SLOTS)

  payload <- list(
    data = .vizr_json_columns(data),
    spec = .vizr_json(hooks$spec),
    expandData = if (!is.null(expand_data)) .vizr_json_columns(expand_data),
    jsHooks = .vizr_json(as.list(hooks$paths)),
    metadata = .vizr_json(metadata),
    bDebug = isTRUE(bDebug)
  )

  htmlwidgets::createWidget(
    name = "tiles",
    x = payload,
    width = width,
    height = height,
    elementId = elementId,
    package = "gsm.vizr",
    # The grid sizes itself (theme$maxHeight scrolls inside it), so the
    # container follows its content rather than a fixed figure height.
    sizingPolicy = htmlwidgets::sizingPolicy(
      defaultWidth = "100%",
      defaultHeight = "auto",
      knitr.figure = FALSE,
      knitr.defaultWidth = "100%",
      knitr.defaultHeight = "auto"
    )
  )
}

.is_column_name <- function(x) {
  is.character(x) && length(x) == 1 && !is.na(x) && nzchar(x)
}

# Fails in R with the message upstream would raise, so a malformed spec never
# reaches the browser as a blank widget.
.validate_tiles_spec <- function(spec, data) {
  for (aes in c("x", "y")) {
    column <- .pluck(spec, "mapping", aes)
    if (!.is_column_name(column)) {
      .fail("spec.mapping.", aes, " is required")
    }
    if (!column %in% names(data)) {
      .fail(
        "spec.mapping.",
        aes,
        " (\"",
        column,
        "\") is not a column of data"
      )
    }
  }
  expand <- .pluck(spec, "expand")
  if (is.null(expand)) {
    return(invisible(spec))
  }
  if (!is.list(expand) || is.data.frame(expand)) {
    .fail("spec.expand must be a list")
  }
  if (!is.data.frame(expand$data)) {
    .fail("spec.expand.data must be a data.frame")
  }
  expand_x <- .pluck(expand, "mapping", "x")
  if (!.is_column_name(expand_x)) {
    .fail("spec.expand.mapping.x is required")
  }
  required <- c(spec$mapping$x, spec$mapping$y, expand_x)
  missing <- setdiff(required, names(expand$data))
  if (length(missing) > 0) {
    .fail(
      "spec.expand.data must contain the columns ",
      paste0("\"", required, "\"", collapse = ", "),
      " (missing: ",
      paste0("\"", missing, "\"", collapse = ", "),
      ")"
    )
  }
  invisible(spec)
}

# Upstream rejects non-array orders, and auto_unbox would collapse a one-value
# order or initial expansion to a scalar.
.normalize_tiles_arrays <- function(spec) {
  as_array <- function(x) {
    if (is.factor(x)) x <- as.character(x)
    .as_json_array(x)
  }
  spec$scales$x$order <- as_array(.pluck(spec, "scales", "x", "order"))
  spec$scales$y$order <- as_array(.pluck(spec, "scales", "y", "order"))
  spec$scales$fill$order <- as_array(.pluck(spec, "scales", "fill", "order"))
  spec$expand$initial <- as_array(.pluck(spec, "expand", "initial"))
  spec$expand$scales$fill$order <- as_array(.pluck(
    spec,
    "expand",
    "scales",
    "fill",
    "order"
  ))
  spec
}
