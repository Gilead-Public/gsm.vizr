#' Build and validate a gsm.viz bars spec
#'
#' Faithful 1:1 construction of the JS spec object: arguments map to
#' top-level spec keys, aesthetics nest under `mapping`. Validation mirrors
#' gsm.viz `src/bars/validateSpec.js` (same messages), so invalid specs fail
#' in R before reaching the browser. JSON-safe features (`tooltip$format`,
#' label templates) are the documented first choice; `js_hook()` is the
#' escape hatch for function-valued slots.
#'
#' @param x,y,fill `character(1)` Column names for the aesthetics; `x` required.
#' @param orientation `"vertical"` or `"horizontal"`.
#' @param position One of `"stack"`, `"dodge"`, `"identity"`, `"fill"`, `"layer"`.
#' @param stat One of `"count"`, `"identity"`, `"percent"` (gsm.viz default: count).
#' @param nCategories `integer(1)` Top-N category cap.
#' @param scales,labels,annotations,tooltip,callbacks,selection,theme,zoom,legend
#'   `list` Passed through 1:1; see the gsm.viz bars documentation.
#' @param interactive `logical(1)` gsm.viz `interactive` flag.
#' @return A plain list ready for [bars()].
#' @export
bars_spec <- function(
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
) {
  spec <- .drop_null(list(
    mapping = .drop_null(list(x = x, y = y, fill = fill)),
    orientation = orientation,
    position = position,
    stat = stat,
    nCategories = nCategories,
    scales = scales,
    labels = labels,
    annotations = annotations,
    tooltip = tooltip,
    callbacks = callbacks,
    selection = selection,
    theme = theme,
    zoom = zoom,
    legend = legend,
    interactive = interactive
  ))
  # Named character vector is the natural R form for value -> hex maps.
  if (is.character(.pluck(spec, "scales", "fill", "colors"))) {
    spec$scales$fill$colors <- as.list(spec$scales$fill$colors)
  }
  .validate_bars_spec(spec)
  spec
}

.drop_null <- function(x) x[!vapply(x, is.null, logical(1))]

.fail <- function(...) stop(..., call. = FALSE)

# Mirrors JS optional chaining: reading through a non-list yields NULL rather
# than R's "$ operator is invalid for atomic vectors". Uses [[ ]] throughout, so
# a spec key never resolves by partial name match the way $ would.
.pluck <- function(x, ...) {
  for (key in c(...)) {
    if (!is.list(x)) {
      return(NULL)
    }
    x <- x[[key]]
  }
  x
}

# Mirrors gsm.viz src/bars/validateSpec.js (2.4.1) message-for-message and in
# the same order, so a spec with several problems reports the same first one and
# this file stays diffable against the JS. Two deliberate divergences:
# referenceLines indices are 1-based (R), not 0-based; and the `data` checks
# upstream performs stay in bars(), which owns the data argument.
# partial = TRUE for proxy spec deltas, which carry no mapping.
.validate_bars_spec <- function(spec, partial = FALSE) {
  if (is.null(spec)) {
    .fail("spec is required")
  }
  .check_object(spec, "spec")
  if (!partial) {
    # An empty mapping is "present" here, matching JS truthiness of {}: the
    # missing-x message is the more useful one and upstream reports it too.
    if (is.null(.pluck(spec, "mapping"))) {
      .fail("spec.mapping is required")
    }
    if (is.null(.pluck(spec, "mapping", "x"))) {
      .fail("spec.mapping.x is required")
    }
  }
  .check_enum(
    .pluck(spec, "position"),
    c("stack", "dodge", "identity", "fill", "layer"),
    "spec.position"
  )
  .check_enum(
    .pluck(spec, "stat"),
    c("count", "identity", "percent"),
    "spec.stat"
  )
  .check_enum(
    .pluck(spec, "orientation"),
    c("vertical", "horizontal"),
    "spec.orientation"
  )
  .check_positive_int(.pluck(spec, "nCategories"), "spec.nCategories")

  .check_enum(
    .pluck(spec, "scales", "x", "sort"),
    c("total", "alphanumeric"),
    "spec.scales.x.sort"
  )
  .check_enum(
    .pluck(spec, "scales", "x", "sortDir"),
    c("asc", "desc"),
    "spec.scales.x.sortDir"
  )
  .check_flag(.pluck(spec, "scales", "x", "grid"), "spec.scales.x.grid")
  .check_object(.pluck(spec, "scales", "x", "ticks"), "spec.scales.x.ticks")
  .check_positive_int(
    .pluck(spec, "scales", "x", "ticks", "maxLength"),
    "spec.scales.x.ticks.maxLength"
  )
  .check_number_between(
    .pluck(spec, "scales", "x", "ticks", "rotation"),
    0,
    90,
    "spec.scales.x.ticks.rotation"
  )
  # Upstream omits the `spec.` prefix on this one message; keep it verbatim.
  .check_object(.pluck(spec, "scales", "fill", "colors"), "scales.fill.colors")

  .check_object(.pluck(spec, "callbacks"), "spec.callbacks")
  for (cb in c("onClick", "onHover", "onSelect")) {
    .check_callback(
      .pluck(spec, "callbacks", cb),
      paste0("spec.callbacks.", cb)
    )
  }

  .check_object(.pluck(spec, "selection"), "spec.selection")
  .check_flag(.pluck(spec, "selection", "enabled"), "spec.selection.enabled")
  .check_number_between(
    .pluck(spec, "selection", "opacity"),
    0,
    1,
    "spec.selection.opacity"
  )
  .check_flag(.pluck(spec, "selection", "multiple"), "spec.selection.multiple")

  captions <- .pluck(spec, "labels", "captions")
  if (!is.null(captions) && (!is.character(captions) || anyNA(captions))) {
    .fail("spec.labels.captions must be a string or an array of strings")
  }
  .check_object(
    .pluck(spec, "labels", "captionsOptions"),
    "spec.labels.captionsOptions"
  )

  for (slot in c("segment", "total")) {
    .check_string_or_function(
      .pluck(spec, "annotations", "labels", slot, "formatter"),
      sprintf("spec.annotations.labels.%s.formatter", slot)
    )
  }
  .validate_reference_lines(.pluck(spec, "annotations", "referenceLines"))

  .check_object(.pluck(spec, "zoom"), "spec.zoom")
  .check_flag(.pluck(spec, "zoom", "enabled"), "spec.zoom.enabled")
  .check_enum(.pluck(spec, "zoom", "mode"), c("x", "y", "xy"), "spec.zoom.mode")
  .check_flag(.pluck(spec, "zoom", "pan"), "spec.zoom.pan")
  .check_flag(.pluck(spec, "zoom", "wheel"), "spec.zoom.wheel")
  .check_flag(.pluck(spec, "zoom", "pinch"), "spec.zoom.pinch")

  .check_object(.pluck(spec, "legend"), "spec.legend")
  .check_flag(.pluck(spec, "legend", "dense"), "spec.legend.dense")

  invisible(spec)
}

.validate_reference_lines <- function(lines) {
  if (is.null(lines)) {
    return(invisible())
  }
  # A JS array is an unnamed list; a named one is the object the user meant to
  # wrap in list().
  if (!is.list(lines) || !is.null(names(lines))) {
    .fail("spec.annotations.referenceLines must be an array")
  }
  for (i in seq_along(lines)) {
    line <- lines[[i]]
    prefix <- sprintf("spec.annotations.referenceLines[%d]", i)
    .check_object(line, prefix)
    if (is.null(line)) {
      .fail(prefix, " must be a plain object")
    }
    value <- .pluck(line, "value")
    if (!is.numeric(value) || length(value) != 1 || !is.finite(value)) {
      .fail(prefix, ".value is required and must be a finite number")
    }
    .check_string(.pluck(line, "label"), paste0(prefix, ".label"))
    .check_string(.pluck(line, "color"), paste0(prefix, ".color"))
    .check_positive_number(
      .pluck(line, "lineWidth"),
      paste0(prefix, ".lineWidth")
    )
    dash <- .pluck(line, "lineDash")
    if (
      !is.null(dash) &&
        (!is.numeric(dash) || !all(is.finite(dash)) || any(dash < 0))
    ) {
      .fail(prefix, ".lineDash must be an array of non-negative numbers")
    }
    .check_enum(
      .pluck(line, "labelPosition"),
      c("start", "center", "end"),
      paste0(prefix, ".labelPosition")
    )
  }
  invisible()
}

.check_enum <- function(value, choices, path) {
  if (is.null(value)) {
    return(invisible())
  }
  if (!is.character(value) || length(value) != 1 || !value %in% choices) {
    .fail(
      path,
      " must be ",
      paste0("'", choices[-length(choices)], "'", collapse = ", "),
      if (length(choices) > 2) "," else "",
      " or '",
      choices[length(choices)],
      "'"
    )
  }
}

.check_flag <- function(value, path) {
  if (is.null(value)) {
    return(invisible())
  }
  if (!is.logical(value) || length(value) != 1 || is.na(value)) {
    .fail(path, " must be a boolean")
  }
}

# A JS "plain object" is a named list in R; length-0 lists carry no names.
.check_object <- function(value, path) {
  if (is.null(value)) {
    return(invisible())
  }
  ok <- is.list(value) &&
    !is.data.frame(value) &&
    (length(value) == 0L || !is.null(names(value)))
  if (!ok) .fail(path, " must be a plain object")
}

.check_string <- function(value, path) {
  if (is.null(value)) {
    return(invisible())
  }
  if (!is.character(value) || length(value) != 1 || is.na(value)) {
    .fail(path, " must be a string")
  }
}

# NA/NaN/Inf are numeric in R but not Number.isFinite upstream; without the
# is.finite() guard the comparisons below return NA and abort with R's
# "missing value where TRUE/FALSE needed" instead of the ported message.
.check_positive_int <- function(value, path) {
  if (is.null(value)) {
    return(invisible())
  }
  ok <- is.numeric(value) &&
    length(value) == 1 &&
    is.finite(value) &&
    value == round(value) &&
    value >= 1
  if (!ok) .fail(path, " must be a positive integer")
}

.check_positive_number <- function(value, path) {
  if (is.null(value)) {
    return(invisible())
  }
  ok <- is.numeric(value) && length(value) == 1 && is.finite(value) && value > 0
  if (!ok) .fail(path, " must be a positive number")
}

.check_number_between <- function(value, low, high, path) {
  if (is.null(value)) {
    return(invisible())
  }
  ok <- is.numeric(value) &&
    length(value) == 1 &&
    is.finite(value) &&
    value >= low &&
    value <= high
  if (!ok) .fail(path, " must be a number between ", low, " and ", high)
}

# js_hook()/htmlwidgets::JS() values carry class JS_EVAL; NULL clears the slot.
.check_callback <- function(value, path) {
  if (is.null(value)) {
    return(invisible())
  }
  if (!inherits(value, "JS_EVAL")) .fail(path, " must be a function or null")
}

.check_string_or_function <- function(value, path) {
  if (is.null(value) || inherits(value, "JS_EVAL")) {
    return(invisible())
  }
  if (!is.character(value) || length(value) != 1) {
    .fail(path, " must be a string or function")
  }
}

#' Build a facetBars facet configuration
#'
#' Keys map 1:1 to gsm.viz `spec.facet` (field, order, nCol, chartHeight,
#' label, scales, legend).
#' @param field `character(1)` Column to facet by. Required.
#' @param order,nCol,chartHeight,label,scales,legend Passed through 1:1.
#' @return A plain list for [facet_bars()].
#' @export
facet_spec <- function(
  field,
  order = NULL,
  nCol = NULL,
  chartHeight = NULL,
  label = NULL,
  scales = NULL,
  legend = NULL
) {
  facet <- .drop_null(list(
    field = field,
    order = order,
    nCol = nCol,
    chartHeight = chartHeight,
    label = label,
    scales = scales,
    legend = legend
  ))
  .validate_facet_spec(facet)
  facet
}

# Mirrors gsm.viz src/facetBars/validateSpec.js (2.4.1) message-for-message and
# in the same order. facetBars validates a different set than bars, so
# facet_bars() is the only entrypoint these branches guard.
.validate_facet_spec <- function(facet) {
  if (is.null(facet)) {
    .fail("spec.facet is required")
  }
  .check_object(facet, "spec.facet")

  field <- .pluck(facet, "field")
  # Upstream tests falsiness first, so "" is "required" rather than "mistyped".
  if (is.null(field) || (is.character(field) && !any(nzchar(field)))) {
    .fail("spec.facet.field is required")
  }
  if (!is.character(field) || length(field) != 1) {
    .fail("spec.facet.field must be a string")
  }

  # Upstream only asks for an array, but .normalize_spec_arrays() turns every R
  # vector into one, so that check could never fire from R. Requiring character
  # instead catches the real mistake it is standing in for: an order given as
  # something other than the facet's own labels.
  order <- .pluck(facet, "order")
  if (!is.null(order) && !is.character(order)) {
    .fail("spec.facet.order must be an array")
  }
  .check_positive_int(.pluck(facet, "nCol"), "spec.facet.nCol")
  .check_positive_number(
    .pluck(facet, "chartHeight"),
    "spec.facet.chartHeight"
  )

  .check_object(.pluck(facet, "scales"), "spec.facet.scales")
  .check_flag(.pluck(facet, "scales", "x", "free"), "spec.facet.scales.x.free")
  .check_flag(.pluck(facet, "scales", "y", "free"), "spec.facet.scales.y.free")

  .check_object(.pluck(facet, "legend"), "spec.facet.legend")
  .check_flag(.pluck(facet, "legend", "sync"), "spec.facet.legend.sync")
  if (!is.null(.pluck(facet, "legend", "chart"))) {
    warning(
      "facetBars: spec.facet.legend.chart is deprecated and has no effect. ",
      "Legends now display on every facet. Use spec.facet.legend.sync ",
      "to control whether legend clicks propagate across facets.",
      call. = FALSE
    )
  }
  .check_flag(.pluck(facet, "legend", "display"), "spec.facet.legend.display")

  .check_object(.pluck(facet, "label"), "spec.facet.label")
  .check_enum(
    .pluck(facet, "label", "position"),
    c("top", "bottom"),
    "spec.facet.label.position"
  )
  .check_string(.pluck(facet, "label", "font"), "spec.facet.label.font")

  invisible(facet)
}

# The facet slot ships separately from spec, so it gets its own preparation.
.prepare_facet <- function(facet) {
  .validate_facet_spec(facet)
  facet$order <- .as_json_array(facet$order)
  facet
}

# facetBars adds this one check on top of the bars spec it delegates to; bars()
# itself never type-checks scales.x.order.
.check_order_array_or_function <- function(value, path) {
  if (is.null(value) || inherits(value, c("JS_EVAL", "AsIs"))) {
    return(invisible())
  }
  if (!is.atomic(value) || !is.null(names(value))) {
    .fail(path, " must be an array or a function")
  }
}
