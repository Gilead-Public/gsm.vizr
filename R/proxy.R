#' Proxy for server-side updates to a rendered bars widget
#'
#' Verbs map 1:1 to `chart.helpers`. Selection verbs pass `_silent` by
#' default so server-driven updates do not echo select events back to the
#' server (no feedback loops). `proxy_update_data()` without a spec reuses
#' the live browser-side spec (`chart.data._spec_`) — the R side never
#' re-pushes a cached spec over toggle-mutated state.
#'
#' Proxy verbs target [bars()] widgets only in 0.1.0. A verb aimed at a
#' [facet_bars()] widget raises a browser-side error naming the widget and the
#' verb rather than silently doing nothing.
#'
#' @param id `character(1)` The widget's Shiny output id.
#' @param session The Shiny session.
#' @return A `gsm_vizr_proxy`; verbs return it invisibly for piping.
#' @export
bars_proxy <- function(id, session = shiny::getDefaultReactiveDomain()) {
  if (is.null(session)) {
    stop(
      "bars_proxy() must be called from within a Shiny session",
      call. = FALSE
    )
  }
  structure(list(id = id, session = session), class = "gsm_vizr_proxy")
}

.proxy_send <- function(proxy, verb, args = list()) {
  stopifnot(inherits(proxy, "gsm_vizr_proxy"))
  proxy$session$sendCustomMessage(
    "gsm-vizr-proxy",
    list(id = proxy$id, verb = verb, args = args)
  )
  invisible(proxy)
}

#' @rdname bars_proxy
#' @param proxy A `gsm_vizr_proxy` from [bars_proxy()].
#' @param data,spec,values,silent,filename Verb arguments; see Details.
#' @export
proxy_update_data <- function(proxy, data, spec = NULL) {
  args <- list(data = .vizr_json(data))
  if (!is.null(spec)) {
    args <- c(args, .proxy_spec_args(spec, data = data))
  }
  .proxy_send(proxy, "updateData", args)
}

#' @rdname bars_proxy
#' @export
proxy_update_spec <- function(proxy, spec) {
  .proxy_send(proxy, "updateSpec", .proxy_spec_args(spec))
}

# A spec sent as an update gets exactly the preparation a spec sent at first
# render gets - partial, because an update carries deltas, not a whole spec.
.proxy_spec_args <- function(spec, data = NULL) {
  prepared <- .prepare_spec(spec, data = data, partial = TRUE)
  list(
    spec = .vizr_json(prepared$spec),
    jsHooks = .vizr_json(as.list(prepared$hooks))
  )
}

#' @rdname bars_proxy
#' @export
proxy_select_category <- function(proxy, values, silent = TRUE) {
  .proxy_send(
    proxy,
    "selectCategory",
    list(values = .vizr_json(as.list(values)), silent = isTRUE(silent))
  )
}

#' @rdname bars_proxy
#' @export
proxy_select_segment <- function(proxy, values, silent = TRUE) {
  .proxy_send(
    proxy,
    "selectSegment",
    list(values = .vizr_json(values), silent = isTRUE(silent))
  )
}

#' @rdname bars_proxy
#' @export
proxy_clear_selection <- function(proxy, silent = TRUE) {
  .proxy_send(proxy, "clearSelection", list(silent = isTRUE(silent)))
}

#' @rdname bars_proxy
#' @export
proxy_export_image <- function(proxy, filename = NULL) {
  .proxy_send(proxy, "exportImage", list(filename = filename))
}
