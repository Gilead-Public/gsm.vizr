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
