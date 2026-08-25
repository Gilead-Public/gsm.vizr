#' Mark a spec slot as literal JavaScript
#'
#' Alias for [htmlwidgets::JS()]. Only the function-valued gsm.viz slots are
#' revived in the browser: `tooltip$formatter`, `callbacks$onClick`,
#' `callbacks$onHover`, `callbacks$onSelect`, the two annotation label
#' formatters, and `scales$x$order`. Anywhere else, [bars()] errors. Prefer the
#' JSON-safe alternatives (`tooltip$format`, label `format` strings) where they
#' suffice.
#'
#' A function-valued `scales$x$order` is a [facet_bars()] feature: facetBars
#' calls it once per facet as `order(facetValue, facetData)` to order that
#' facet's categories. Plain [bars()] hands the slot to gsm.viz, which expects
#' an array there and has no function branch.
#' @param ... Character strings of JavaScript, concatenated by newlines.
#' @return A `JS_EVAL` string, as returned by [htmlwidgets::JS()].
#' @export
js_hook <- function(...) htmlwidgets::JS(...)

.JS_SLOTS <- list(
  c("tooltip", "formatter"),
  c("callbacks", "onClick"),
  c("callbacks", "onHover"),
  c("callbacks", "onSelect"),
  c("annotations", "labels", "segment", "formatter"),
  c("annotations", "labels", "total", "formatter"),
  # facetBars-only: upstream calls it per facet. See js_hook()'s note.
  c("scales", "x", "order")
)

#' Split JS_EVAL slots out of a spec (internal)
#'
#' Replaces JS() values at the known slots with their code strings and
#' returns the dot-paths for browser-side revival; any JS() elsewhere is an
#' error so unsupported hooks fail in R, not silently in the browser.
#' @noRd
.extract_js_hooks <- function(spec) {
  paths <- character()
  for (slot in .JS_SLOTS) {
    value <- .pluck(spec, slot)
    if (inherits(value, "JS_EVAL")) {
      spec[[slot]] <- paste(as.character(value), collapse = "\n")
      paths <- c(paths, paste(slot, collapse = "."))
    }
  }
  # Runs after extraction, so the allowed slots are plain strings by now and
  # only genuinely unsupported hooks remain to be found.
  .assert_no_stray_js(spec, path = character())
  list(spec = spec, paths = paths)
}

.assert_no_stray_js <- function(x, path) {
  if (inherits(x, "JS_EVAL")) {
    .fail(
      "js_hook() is only supported at: ",
      paste(vapply(.JS_SLOTS, paste, "", collapse = "."), collapse = ", "),
      " (found at ",
      paste(path, collapse = "."),
      ")"
    )
  }
  if (is.list(x)) {
    # seq_along, not names(): unnamed lists (referenceLines, captions options)
    # have NULL names, and a for-over-NULL loop silently visits nothing.
    nms <- names(x)
    for (i in seq_along(x)) {
      key <- if (!is.null(nms) && nzchar(nms[[i]])) {
        nms[[i]]
      } else {
        as.character(i)
      }
      .assert_no_stray_js(x[[i]], c(path, key))
    }
  }
}
