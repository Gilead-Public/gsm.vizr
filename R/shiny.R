#' Shiny bindings for bars
#'
#' `height` and the `minHeight` of the widget it renders apply to the same
#' container, and `minHeight` is a floor, so it wins. The default here matches
#' [bars()]'s default `minHeight` for that reason. To render an output shorter
#' than 500px, lower both — `barsOutput(height = "300px")` alone stays 500px
#' tall until the widget is built with `bars(..., minHeight = 300)`.
#'
#' A `metadata$chartId` is ignored under Shiny: the output id is what the proxy
#' verbs and `input$<id>_click` / `input$<id>_select` are keyed on, so the
#' binding keeps it and warns instead of renaming the element.
#'
#' @param outputId,width,height,expr,env,quoted Standard htmlwidgets Shiny
#'   binding parameters.
#' @return `barsOutput()` returns a Shiny output element; `renderBars()`
#'   returns a render function for that output.
#' @name bars-shiny
#' @export
barsOutput <- function(outputId, width = "100%", height = "500px") {
  htmlwidgets::shinyWidgetOutput(
    outputId,
    "bars",
    width,
    height,
    package = "gsm.vizr"
  )
}

#' @rdname bars-shiny
#' @export
renderBars <- function(expr, env = parent.frame(), quoted = FALSE) {
  if (!quoted) {
    expr <- substitute(expr)
  }
  htmlwidgets::shinyRenderWidget(expr, barsOutput, env, quoted = TRUE)
}

#' Shiny bindings for tiles
#'
#' Interactions are mirrored to Shiny inputs keyed on the output id:
#' `input$<id>_click`, `input$<id>_rowclick` and `input$<id>_expand`, each
#' carrying the same `detail` as the `gsm-viz-select` event (see [tiles()]).
#' A `metadata$chartId` is ignored under Shiny so those input names stay
#' keyed on the output id; the binding warns instead of renaming the element.
#'
#' The default `height = "auto"` lets the grid size itself; its scroll height
#' is set by the spec's `theme$maxHeight`.
#'
#' @param outputId,width,height,expr,env,quoted Standard htmlwidgets Shiny
#'   binding parameters.
#' @return `tilesOutput()` returns a Shiny output element; `renderTiles()`
#'   returns a render function for that output.
#' @name tiles-shiny
#' @export
tilesOutput <- function(outputId, width = "100%", height = "auto") {
  htmlwidgets::shinyWidgetOutput(
    outputId,
    "tiles",
    width,
    height,
    package = "gsm.vizr"
  )
}

#' @rdname tiles-shiny
#' @export
renderTiles <- function(expr, env = parent.frame(), quoted = FALSE) {
  if (!quoted) {
    expr <- substitute(expr)
  }
  htmlwidgets::shinyRenderWidget(expr, tilesOutput, env, quoted = TRUE)
}
