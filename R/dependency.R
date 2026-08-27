#' HTML dependency for the vendored gsm.viz bundle
#'
#' For custom widgets built outside this package: declare this dependency
#' instead of vendoring the bundle again. Loading it defines `window.gsmViz`.
#' @return An [htmltools::htmlDependency()].
#' @export
html_dependency_gsm_viz <- function() {
  htmltools::htmlDependency(
    name = "gsmViz",
    version = "2.4.1",
    src = c(
      file = system.file(
        "htmlwidgets",
        "lib",
        "gsm.viz-2.4.1",
        package = "gsm.vizr"
      )
    ),
    script = "index.js",
    stylesheet = "main.css"
  )
}
