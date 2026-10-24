#' HTML dependency for the vendored gsm.viz bundle
#'
#' For custom widgets built outside this package: declare this dependency
#' instead of vendoring the bundle again. Loading it defines `window.gsmViz`.
#' @return An [htmltools::htmlDependency()].
#' @export
html_dependency_gsm_viz <- function() {
  # PROVISIONAL: development bundle built from Gilead-Public/gsm.viz commit
  # 9c730931822bb74e5fa16a8051f74a629e6153a6 (PR #615); rebuild from the
  # release tag before merge/release.
  htmltools::htmlDependency(
    name = "gsmViz",
    version = "2.5.0-615",
    src = c(
      file = system.file(
        "htmlwidgets",
        "lib",
        "gsm.viz-2.5.0-615",
        package = "gsm.vizr"
      )
    ),
    script = "index.js",
    stylesheet = "main.css"
  )
}
