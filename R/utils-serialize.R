#' Serialize a payload slot under the gsm.vizr contract (internal)
#'
#' Rows-wise data frames, NA and NULL both as JSON null, scalars unboxed.
#' Factors serialize as their labels; their levels feed the order keys
#' derived in bars(). The json-classed string is embedded verbatim by
#' htmlwidgets and shiny, so this is the single R-to-JS boundary.
#' @noRd
.vizr_json <- function(x) {
  jsonlite::toJSON(
    x,
    dataframe = "rows",
    null = "null",
    na = "null",
    auto_unbox = TRUE
  )
}

#' Fill scales order keys from factor levels (internal)
#'
#' fct_infreq()/fct_rev() semantics travel to the browser as explicit
#' order arrays; an order set by the caller always wins.
#' @noRd
.derive_orders <- function(data, spec) {
  for (aes in c("x", "fill")) {
    column <- .pluck(spec, "mapping", aes)
    if (
      !is.character(column) || !is.null(.pluck(spec, "scales", aes, "order"))
    ) {
      next
    }
    # [[ on a data.frame yields NULL for an absent column, so a mapping naming a
    # column the data lacks derives nothing instead of failing here.
    values <- data[[column]]
    if (is.factor(values)) spec$scales[[aes]]$order <- levels(values)
  }
  spec
}

#' Keep array-typed spec slots as JSON arrays (internal)
#'
#' auto_unbox = TRUE collapses length-1 atomic vectors to scalars. Upstream
#' calls .filter() on scales.x.order / scales.fill.order, so a one-level
#' factor would raise an uncaught TypeError in structureData.js instead of a
#' named error. I() marks the value AsIs; toJSON then always emits an array.
#' Applies to every array slot, including the two (facet$order, lineDash)
#' that never pass through .derive_orders().
#' @noRd
.normalize_spec_arrays <- function(spec) {
  # Assigning NULL into an absent nested path is a no-op in R, so these four
  # lines never materialise an empty scales/facet object on a minimal spec.
  spec$scales$x$order <- .as_json_array(.pluck(spec, "scales", "x", "order"))
  spec$scales$fill$order <- .as_json_array(.pluck(
    spec,
    "scales",
    "fill",
    "order"
  ))
  spec$facet$order <- .as_json_array(.pluck(spec, "facet", "order"))
  lines <- .pluck(spec, "annotations", "referenceLines")
  if (is.list(lines)) {
    spec$annotations$referenceLines <- lapply(lines, function(line) {
      if (is.list(line)) {
        line$lineDash <- .as_json_array(line$lineDash)
      }
      line
    })
  }
  spec
}

# NULL stays NULL (the slot is dropped); a function-valued order (js_hook) is
# left alone - upstream accepts "an array or a function" for scales.x.order.
.as_json_array <- function(x) {
  if (is.null(x) || inherits(x, c("AsIs", "JS_EVAL"))) {
    return(x)
  }
  I(x)
}

#' The single spec-to-JSON preparation path (internal)
#'
#' Every caller - bars(), facet_bars(), and the proxy verbs - prepares specs
#' here, so a spec sent as a server-side update is treated exactly like one
#' sent at first render. partial = TRUE relaxes the required-mapping check for
#' proxy deltas. data = NULL skips order derivation (nothing to derive from).
#' @noRd
.prepare_spec <- function(spec, data = NULL, partial = FALSE) {
  .validate_bars_spec(spec, partial = partial)
  if (!is.null(data)) {
    spec <- .derive_orders(data, spec)
  }
  spec <- .normalize_spec_arrays(spec)
  list(spec = spec, hooks = character()) # hook extraction wired in Task 8
}
