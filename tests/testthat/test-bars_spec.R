test_that("bars_spec() builds the nested mapping and drops NULLs", {
  s <- bars_spec(
    x = "invid",
    y = "n",
    fill = "flag",
    orientation = "horizontal",
    stat = "identity"
  )
  expect_identical(s$mapping, list(x = "invid", y = "n", fill = "flag"))
  expect_identical(s$orientation, "horizontal")
  expect_identical(s$stat, "identity")
  expect_false("nCategories" %in% names(s))
  expect_false("y" %in% names(s)) # y lives only under mapping
})

test_that("bars_spec() mirrors validateSpec.js enums", {
  expect_error(
    bars_spec(x = "a", position = "stacked"),
    "spec.position must be 'stack', 'dodge', 'identity', 'fill', or 'layer'"
  )
  expect_error(
    bars_spec(x = "a", stat = "sum"),
    "spec.stat must be 'count', 'identity', or 'percent'"
  )
  expect_error(
    bars_spec(x = "a", orientation = "sideways"),
    "spec.orientation must be 'vertical' or 'horizontal'"
  )
  expect_error(
    bars_spec(x = "a", nCategories = 0),
    "spec.nCategories must be a positive integer"
  )
  expect_error(
    bars_spec(x = "a", scales = list(x = list(sort = "frequency"))),
    "spec.scales.x.sort must be 'total' or 'alphanumeric'"
  )
  expect_error(
    bars_spec(x = "a", scales = list(x = list(sortDir = "up"))),
    "spec.scales.x.sortDir must be 'asc' or 'desc'"
  )
  expect_error(
    bars_spec(x = "a", scales = list(x = list(ticks = list(rotation = 120)))),
    "spec.scales.x.ticks.rotation must be a number between 0 and 90"
  )
  expect_error(
    bars_spec(x = "a", selection = list(opacity = 2)),
    "spec.selection.opacity must be a number between 0 and 1"
  )
  expect_error(
    bars_spec(x = "a", zoom = list(mode = "z")),
    "spec.zoom.mode must be 'x', 'y', or 'xy'"
  )
  expect_error(
    bars_spec(x = "a", labels = list(captions = 1)),
    "spec.labels.captions must be a string or an array of strings"
  )
  expect_error(
    bars_spec(
      x = "a",
      annotations = list(referenceLines = list(list(label = "no value")))
    ),
    "referenceLines\\[1\\].value is required and must be a finite number"
  )
})

test_that("container slots must be plain objects", {
  expect_error(.validate_bars_spec("nope"), "spec must be a plain object")
  expect_error(
    bars_spec(x = "a", selection = TRUE),
    "spec.selection must be a plain object"
  )
  expect_error(
    bars_spec(x = "a", zoom = "on"),
    "spec.zoom must be a plain object"
  )
  expect_error(
    bars_spec(x = "a", legend = 1),
    "spec.legend must be a plain object"
  )
  expect_error(
    bars_spec(x = "a", scales = list(x = list(ticks = "big"))),
    "spec.scales.x.ticks must be a plain object"
  )
  expect_error(
    bars_spec(x = "a", callbacks = "onClick"),
    "spec.callbacks must be a plain object"
  )
  expect_error(
    bars_spec(x = "a", labels = list(captionsOptions = "small")),
    "spec.labels.captionsOptions must be a plain object"
  )
  expect_error(
    bars_spec(x = "a", annotations = list(referenceLines = list(value = 5))),
    "spec.annotations.referenceLines must be an array"
  )
})

test_that("callbacks accept a JS function or NULL and nothing else", {
  # htmlwidgets::JS() here, not js_hook() — the exported alias lands in Task 8.
  expect_error(
    bars_spec(x = "a", callbacks = list(onClick = "alert(1)")),
    "spec.callbacks.onClick must be a function or null"
  )
  expect_error(
    bars_spec(x = "a", callbacks = list(onHover = 1)),
    "spec.callbacks.onHover must be a function or null"
  )
  expect_error(
    bars_spec(x = "a", callbacks = list(onSelect = list())),
    "spec.callbacks.onSelect must be a function or null"
  )
  s <- bars_spec(
    x = "a",
    callbacks = list(onClick = htmlwidgets::JS("function () {}"))
  )
  expect_s3_class(s$callbacks$onClick, "JS_EVAL")
})

test_that("reference-line fields are validated per line", {
  rl <- function(...) {
    bars_spec(
      x = "a",
      annotations = list(referenceLines = list(list(value = 5, ...)))
    )
  }
  expect_error(rl(color = 1), "referenceLines\\[1\\].color must be a string")
  expect_error(rl(label = 1), "referenceLines\\[1\\].label must be a string")
  expect_error(
    rl(lineWidth = 0),
    "referenceLines\\[1\\].lineWidth must be a positive number"
  )
  expect_error(
    rl(lineDash = c(4, -1)),
    "referenceLines\\[1\\].lineDash must be an array of non-negative numbers"
  )
  expect_error(
    rl(labelPosition = "middle"),
    "referenceLines\\[1\\].labelPosition must be 'start', 'center', or 'end'"
  )
  # Second line reported as [2]: 1-based per R convention (upstream is 0-based).
  expect_error(
    bars_spec(
      x = "a",
      annotations = list(
        referenceLines = list(
          list(value = 1),
          list(value = 2, color = 99)
        )
      )
    ),
    "referenceLines\\[2\\].color must be a string"
  )
})

test_that("annotation label formatters accept a string or a js_hook()", {
  fmt <- function(v) {
    bars_spec(
      x = "a",
      annotations = list(labels = list(segment = list(formatter = v)))
    )
  }
  expect_error(
    fmt(1),
    "spec.annotations.labels.segment.formatter must be a string or function"
  )
  expect_silent(fmt(",d"))
  expect_silent(fmt(htmlwidgets::JS("function (v) { return v; }")))
})

test_that("partial validation skips the required-mapping checks", {
  # proxy_update_spec() sends deltas: a spec fragment need not carry mapping.
  expect_error(
    .validate_bars_spec(list(position = "stack")),
    "spec.mapping is required"
  )
  expect_error(
    .validate_bars_spec(list(mapping = list(fill = "flag"))),
    "spec.mapping.x is required"
  )
  expect_silent(.validate_bars_spec(list(position = "stack"), partial = TRUE))
  expect_error(
    .validate_bars_spec(list(position = "bogus"), partial = TRUE),
    "spec.position must be"
  )
})

test_that("the spec container itself is required", {
  # .check_object() short-circuits on NULL, so without an explicit guard a NULL
  # spec would slip through every downstream check untouched.
  expect_error(.validate_bars_spec(NULL), "spec is required")
  expect_error(.validate_bars_spec(NULL, partial = TRUE), "spec is required")
})

test_that("non-finite numbers report the ported message, not an R internal error", {
  # Upstream guards these with Number.isFinite; a bare `rot > 90` on NaN aborts
  # with "missing value where TRUE/FALSE needed" and buries the real problem.
  expect_error(
    bars_spec(x = "a", scales = list(x = list(ticks = list(rotation = NaN)))),
    "spec.scales.x.ticks.rotation must be a number between 0 and 90"
  )
  expect_error(
    bars_spec(x = "a", selection = list(opacity = NA_real_)),
    "spec.selection.opacity must be a number between 0 and 1"
  )
  expect_error(
    bars_spec(x = "a", nCategories = Inf),
    "spec.nCategories must be a positive integer"
  )
})

test_that("atomic containers are traversed as JS optional chaining would", {
  # `spec$scales$x$sort` aborts with "$ operator is invalid for atomic vectors"
  # when scales is atomic; upstream's `spec.scales?.x?.sort` yields undefined and
  # validates clean. Nested reads go through .pluck() to keep that behaviour.
  expect_silent(.validate_bars_spec(list(
    mapping = list(x = "a"),
    scales = "wat"
  )))
  expect_silent(.validate_bars_spec(list(mapping = list(x = "a"), labels = 3)))
  expect_silent(.validate_bars_spec(list(
    mapping = list(x = "a"),
    annotations = TRUE
  )))
})

test_that("x is required and fill colors become a named list", {
  expect_error(bars_spec(x = NULL), "spec.mapping.x is required")
  s <- bars_spec(
    x = "site",
    scales = list(fill = list(colors = c(`2` = "#c91b1d", `1` = "#fdb84c")))
  )
  expect_identical(s$scales$fill$colors, list(`2` = "#c91b1d", `1` = "#fdb84c"))
})

test_that("captions accept a character vector (regulatory footnotes)", {
  s <- bars_spec(x = "site", labels = list(captions = c("line 1", "line 2")))
  expect_identical(s$labels$captions, c("line 1", "line 2"))
})
