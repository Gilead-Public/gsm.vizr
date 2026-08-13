#' Shiny bindings for bars
#'
#' @param outputId,width,height,expr,env,quoted Standard htmlwidgets Shiny
#'   binding parameters.
#' @return `barsOutput()` returns a Shiny output element; `renderBars()`
#'   returns a render function for that output.
#' @name bars-shiny
#' @export
barsOutput <- function(outputId, width = "100%", height = "400px") {
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
