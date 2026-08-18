test_that("bars() returns a gsm.vizr htmlwidget with json-classed payload", {
  df <- data.frame(site = c("S1", "S1", "S2"), flag = c("2", "1", "2"))
  w <- bars(df, list(mapping = list(x = "site", fill = "flag")))
  expect_s3_class(w, "bars")
  expect_s3_class(w, "htmlwidget")
  expect_s3_class(w$x$data, "json")
  expect_s3_class(w$x$spec, "json")
  expect_s3_class(w$x$metadata, "json")
  expect_identical(w$x$minHeight, 500)
  expect_match(as.character(w$x$data), '"site":"S1"', fixed = TRUE)
  expect_match(
    as.character(w$x$spec),
    '"mapping":{"x":"site","fill":"flag"}',
    fixed = TRUE
  )
})

test_that("serialization writes NA as null, rows-wise, factors as values", {
  df <- data.frame(
    site = factor(c("S2", "S1"), levels = c("S2", "S1")),
    n = c(3, NA)
  )
  w <- bars(df, list(mapping = list(x = "site", y = "n")))
  json <- as.character(w$x$data)
  expect_match(json, '"n":null', fixed = TRUE) # the na = "null" contract
  expect_match(json, '"site":"S2"', fixed = TRUE) # factor -> value, not integer
  expect_no_match(json, '"NA"', fixed = TRUE) # never the pilot's "NA" string
})

test_that("bars() validates its inputs", {
  expect_error(bars(list(a = 1), list(mapping = list(x = "a"))), "data.frame")
  expect_error(bars(data.frame(a = 1), spec = "nope"), "list")
})

test_that("factor levels derive the order keys", {
  df <- data.frame(
    site = factor(c("S1", "S2"), levels = c("S2", "S1")),
    flag = factor(c("1", "2"), levels = c("2", "1", "0"))
  )
  w <- bars(df, bars_spec(x = "site", fill = "flag"))
  spec <- jsonlite::fromJSON(w$x$spec, simplifyVector = TRUE)
  expect_identical(spec$scales$x$order, c("S2", "S1"))
  expect_identical(spec$scales$fill$order, c("2", "1", "0"))
})

test_that("single-element order arrays stay arrays in JSON", {
  # auto_unbox would emit "order":"S1"; upstream resolveCategories() then calls
  # .filter() on a string -> uncaught TypeError, blank widget, no diagnostic.
  # Assert on raw JSON: fromJSON(simplifyVector) erases the array/scalar split.
  df <- data.frame(
    site = factor("S1", levels = "S1"),
    flag = factor("2", levels = "2")
  )
  json <- as.character(bars(df, bars_spec(x = "site", fill = "flag"))$x$spec)
  expect_match(json, '"order":["S1"]', fixed = TRUE)
  expect_match(json, '"order":["2"]', fixed = TRUE)
  expect_no_match(json, '"order":"', fixed = TRUE)
})

test_that("a one-value explicit order and a one-value lineDash stay arrays", {
  df <- data.frame(site = c("S1", "S2"), n = c(1, 2))
  json <- as.character(
    bars(
      df,
      bars_spec(
        x = "site",
        y = "n",
        stat = "identity",
        scales = list(x = list(order = "S1")),
        annotations = list(referenceLines = list(list(value = 1, lineDash = 5)))
      )
    )$x$spec
  )
  expect_match(json, '"order":["S1"]', fixed = TRUE)
  expect_match(json, '"lineDash":[5]', fixed = TRUE)
})

test_that("a hand-written spec passed straight to bars() is validated", {
  # .prepare_spec() validates every spec, not just bars_spec() output.
  df <- data.frame(site = "S1")
  expect_error(
    bars(df, list(mapping = list(x = "site"), position = "stacked")),
    "spec.position must be"
  )
})

test_that("an explicit order wins over factor levels", {
  df <- data.frame(site = factor(c("S1", "S2"), levels = c("S2", "S1")))
  w <- bars(
    df,
    bars_spec(x = "site", scales = list(x = list(order = c("S1", "S2"))))
  )
  spec <- jsonlite::fromJSON(w$x$spec, simplifyVector = TRUE)
  expect_identical(spec$scales$x$order, c("S1", "S2"))
})

test_that("non-factor columns derive no order", {
  df <- data.frame(site = c("S1", "S2"))
  w <- bars(df, bars_spec(x = "site"))
  spec <- jsonlite::fromJSON(w$x$spec, simplifyVector = FALSE)
  expect_null(spec$scales$x$order)
})

test_that("normalization does not invent spec keys the caller never set", {
  # .normalize_spec_arrays() assigns into scales/facet/referenceLines paths that
  # a minimal spec does not have. Assigning NULL there must stay a no-op rather
  # than materialise "scales":{} / "facet":{}, which would change the payload
  # shape upstream sees for every plain chart.
  json <- as.character(
    bars(data.frame(site = "S1"), bars_spec(x = "site"))$x$spec
  )
  expect_no_match(json, "scales", fixed = TRUE)
  expect_no_match(json, "facet", fixed = TRUE)
  expect_no_match(json, "annotations", fixed = TRUE)
})

test_that("a spec column absent from the data derives no order and does not error", {
  # mapping$x naming a missing column is the user's error to hit downstream in
  # gsm.viz, not a subscript failure inside order derivation.
  df <- data.frame(other = factor("A"))
  expect_silent(bars(df, bars_spec(x = "site")))
})

test_that("metadata must be named and serializes as an object {#1}", {
  df <- data.frame(site = "S1")
  sp <- bars_spec(x = "site")
  expect_error(bars(df, sp, metadata = list("a")), "metadata must be a named list", fixed = TRUE)
  expect_error(bars(df, sp, metadata = list(a = 1, 2)), "metadata must be a named list", fixed = TRUE)
  # default and empty both reach the browser as {} - the documented object shape
  expect_match(as.character(bars(df, sp)$x$metadata), "^\\{")
  expect_match(as.character(bars(df, sp, metadata = list(chartId = "c1"))$x$metadata), "^\\{")
})
