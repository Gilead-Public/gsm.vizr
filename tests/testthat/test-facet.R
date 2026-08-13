test_that("facet_spec() builds the facet object", {
  f <- facet_spec("country", order = c("USA", "CAN"), nCol = 2)
  expect_identical(
    f,
    list(field = "country", order = c("USA", "CAN"), nCol = 2)
  )
  expect_error(facet_spec(NULL), "spec.facet.field is required")
})

test_that("facet_spec() validates the fields it passes through", {
  expect_error(
    facet_spec("ctry", order = 1),
    "spec.facet.order must be an array"
  )
  expect_error(
    facet_spec("ctry", nCol = 0),
    "spec.facet.nCol must be a positive integer"
  )
  expect_error(
    facet_spec("ctry", chartHeight = -1),
    "spec.facet.chartHeight must be a positive number"
  )
  expect_error(
    facet_spec("ctry", scales = list(x = list(free = "yes"))),
    "spec.facet.scales.x.free must be a boolean"
  )
  expect_error(
    facet_spec("ctry", scales = list(y = list(free = "yes"))),
    "spec.facet.scales.y.free must be a boolean"
  )
  expect_error(
    facet_spec("ctry", legend = list(sync = 1)),
    "spec.facet.legend.sync must be a boolean"
  )
  expect_error(
    facet_spec("ctry", legend = list(display = 1)),
    "spec.facet.legend.display must be a boolean"
  )
  expect_error(
    facet_spec("ctry", label = list(font = 12)),
    "spec.facet.label.font must be a string"
  )
})

test_that("the facet container itself is required and must be an object", {
  expect_error(.validate_facet_spec(NULL), "spec.facet is required")
  expect_error(
    .validate_facet_spec("country"),
    "spec.facet must be a plain object"
  )
})

test_that("field is reported as missing separately from being mistyped", {
  # Upstream splits these: a falsy field is "is required", a truthy non-string
  # is "must be a string". Collapsing them loses the more useful message.
  expect_error(facet_spec(""), "spec.facet.field is required")
  expect_error(facet_spec(12), "spec.facet.field must be a string")
})

test_that("label position is an enum, not any string", {
  expect_error(
    facet_spec("ctry", label = list(position = "left")),
    "spec.facet.label.position must be 'top' or 'bottom'"
  )
  expect_silent(facet_spec("ctry", label = list(position = "bottom")))
})

test_that("the deprecated legend.chart key warns instead of failing silently", {
  # Upstream console.warns and ignores it; surfacing that in R means the author
  # sees it, rather than it sitting in a browser console nobody opens.
  expect_warning(facet_spec("ctry", legend = list(chart = 1)), "deprecated")
})

test_that("a single-value facet order stays a JSON array", {
  # facet$order never passes through .derive_orders(); without normalization
  # auto_unbox emits "order":"USA" and facetBars throws on the scalar.
  df <- data.frame(site = c("S1", "S2"), country = "USA")
  w <- facet_bars(
    df,
    bars_spec(x = "site"),
    facet_spec("country", order = "USA")
  )
  expect_match(as.character(w$x$facet), '"order":["USA"]', fixed = TRUE)
})

test_that("facet_bars() serializes the facet slot and derives orders", {
  df <- data.frame(
    site = factor(c("S1", "S2"), levels = c("S2", "S1")),
    country = c("USA", "CAN")
  )
  w <- facet_bars(df, bars_spec(x = "site"), facet_spec("country"))
  expect_s3_class(w, "bars") # same binding
  expect_s3_class(w$x$facet, "json")
  expect_match(as.character(w$x$facet), '"field":"country"', fixed = TRUE)
  spec <- jsonlite::fromJSON(w$x$spec, simplifyVector = TRUE)
  expect_identical(spec$scales$x$order, c("S2", "S1"))
})

test_that("facet_bars() enforces the x-order rule only facetBars checks", {
  # bars/validateSpec.js never type-checks scales.x.order; facetBars does, so
  # this is the one entrypoint where a named-list order would reach a validator.
  df <- data.frame(site = c("S1", "S2"), country = "USA")
  expect_error(
    facet_bars(
      df,
      bars_spec(x = "site", scales = list(x = list(order = list(a = "S1")))),
      facet_spec("country")
    ),
    "spec.scales.x.order must be an array or a function"
  )
})

test_that("plain bars() carries no facet slot", {
  w <- bars(data.frame(site = "S1"), bars_spec(x = "site"))
  expect_null(w$x$facet)
})
