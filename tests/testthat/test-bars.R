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
