test_that("js_hook() slots are extracted to dot-paths with string bodies", {
  df <- data.frame(site = "S1")
  spec <- bars_spec(
    x = "site",
    tooltip = list(
      formatter = js_hook("function (n, ctx, d) { return 'n=' + n; }")
    ),
    callbacks = list(
      onClick = js_hook("function (point) { console.log(point); }")
    )
  )
  w <- bars(df, spec)
  hooks <- jsonlite::fromJSON(w$x$jsHooks)
  expect_setequal(hooks, c("tooltip.formatter", "callbacks.onClick"))
  parsed <- jsonlite::fromJSON(w$x$spec, simplifyVector = TRUE)
  expect_match(parsed$tooltip$formatter, "^function") # a plain string now
})

test_that("every allowed slot is extractable", {
  # The allowlist is the contract the browser-side revival in the binding walks;
  # a slot silently dropped from it would leave a JS_EVAL to serialize as text.
  df <- data.frame(site = "S1")
  spec <- bars_spec(
    x = "site",
    tooltip = list(formatter = js_hook("function () {}")),
    callbacks = list(
      onClick = js_hook("function () {}"),
      onHover = js_hook("function () {}"),
      onSelect = js_hook("function () {}")
    ),
    annotations = list(
      labels = list(
        segment = list(formatter = js_hook("function () {}")),
        total = list(formatter = js_hook("function () {}"))
      )
    )
  )
  hooks <- jsonlite::fromJSON(bars(df, spec)$x$jsHooks)
  expect_setequal(
    hooks,
    c(
      "tooltip.formatter",
      "callbacks.onClick",
      "callbacks.onHover",
      "callbacks.onSelect",
      "annotations.labels.segment.formatter",
      "annotations.labels.total.formatter"
    )
  )
})

test_that("js_hook() outside the known slots errors", {
  df <- data.frame(site = "S1")
  spec <- bars_spec(x = "site", labels = list(captions = "x"))
  spec$labels$weird <- js_hook("function () {}")
  expect_error(bars(df, spec), "js_hook\\(\\) is only supported at")
})

test_that("a stray hook inside an unnamed list is caught", {
  # names(x) is NULL for an unnamed list, so a `for (nm in names(x))` loop body
  # never runs - referenceLines[[1]] used to smuggle hooks past the allowlist.
  df <- data.frame(site = "S1", n = 1)
  spec <- bars_spec(
    x = "site",
    y = "n",
    stat = "identity",
    annotations = list(referenceLines = list(list(value = 1)))
  )
  spec$annotations$referenceLines[[1]]$formatter <- js_hook("function () {}")
  expect_error(bars(df, spec), "js_hook\\(\\) is only supported at")
})

test_that("the stray-hook error names where it found the hook", {
  df <- data.frame(site = "S1")
  spec <- bars_spec(x = "site")
  spec$theme <- list(nested = js_hook("function () {}"))
  expect_error(bars(df, spec), "found at theme.nested", fixed = TRUE)
})

test_that("a hook in the facet config is caught too", {
  # facetBars has no function-valued facet slots, so a JS_EVAL here would
  # serialize as a bare string and be ignored without any diagnostic.
  df <- data.frame(site = c("S1", "S2"), country = "USA")
  facet <- facet_spec("country")
  facet$label <- list(formatter = js_hook("function () {}"))
  expect_error(
    facet_bars(df, bars_spec(x = "site"), facet),
    "js_hook\\(\\) is only supported at"
  )
})

test_that("plain-string formatters pass through untouched (d3-format strings)", {
  df <- data.frame(site = "S1")
  w <- bars(df, bars_spec(x = "site", tooltip = list(format = ",d")))
  expect_identical(jsonlite::fromJSON(w$x$jsHooks), list())
})
