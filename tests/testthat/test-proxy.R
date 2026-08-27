fake_session <- function() {
  e <- new.env()
  e$msgs <- list()
  e$sendCustomMessage <- function(type, message) {
    e$msgs[[length(e$msgs) + 1]] <- list(type = type, message = message)
  }
  e
}

test_that("proxy verbs send the gsm-vizr-proxy contract", {
  s <- fake_session()
  p <- bars_proxy("chart", session = s)
  expect_s3_class(p, "gsm_vizr_proxy")

  proxy_select_category(p, c("S1", "S2"))
  m <- s$msgs[[1]]
  expect_identical(m$type, "gsm-vizr-proxy")
  expect_identical(m$message$id, "chart")
  expect_identical(m$message$verb, "selectCategory")
  expect_true(m$message$args$silent) # silent by default
  expect_s3_class(m$message$args$values, "json")

  proxy_select_category(p, "S1", silent = FALSE)
  expect_false(s$msgs[[2]]$message$args$silent)

  proxy_update_data(p, data.frame(site = "S1"))
  m <- s$msgs[[3]]$message
  expect_identical(m$verb, "updateData")
  expect_s3_class(m$args$data, "json")
  expect_null(m$args$spec) # spec authority stays in the browser

  proxy_clear_selection(p)
  proxy_export_image(p, "chart.png")
  expect_identical(s$msgs[[5]]$message$args$filename, "chart.png")
})

test_that("spec-carrying verbs run the shared preparation", {
  s <- fake_session()
  p <- bars_proxy("chart", session = s)

  # Hooks are extracted, and their paths ride along for browser-side revival.
  proxy_update_spec(
    p,
    list(
      tooltip = list(
        formatter = js_hook("function () { return 1; }")
      )
    )
  )
  m <- s$msgs[[1]]$message
  expect_identical(jsonlite::fromJSON(m$args$jsHooks), "tooltip.formatter")
  expect_match(as.character(m$args$spec), '"formatter":"function', fixed = TRUE)

  # Partial specs are legal - an update need not repeat mapping$x ...
  proxy_update_spec(p, list(position = "dodge"))
  # ... but they are still validated.
  expect_error(
    proxy_update_spec(p, list(position = "stacked")),
    "spec.position must be"
  )

  # Data + spec together, one-level factor: the order must stay an array.
  df <- data.frame(site = factor("S1", levels = "S1"))
  proxy_update_data(p, df, spec = list(mapping = list(x = "site")))
  expect_match(
    as.character(s$msgs[[3]]$message$args$spec),
    '"order":["S1"]',
    fixed = TRUE
  )
})

test_that("a single selected value stays a JSON array", {
  # selectCategory() tolerates a scalar upstream, but every other array slot in
  # this package is normalized, and a scalar here would be the odd one out the
  # day upstream stops wrapping.
  s <- fake_session()
  p <- bars_proxy("chart", session = s)
  proxy_select_category(p, "S1")
  expect_match(
    as.character(s$msgs[[1]]$message$args$values),
    "[\"S1\"]",
    fixed = TRUE
  )
})

test_that("proxy_update_data() carries hook paths when it carries a spec", {
  # updateData is the second spec-carrying verb; a hook sent through it needs
  # the same revival paths updateSpec sends, or it lands as a bare string.
  s <- fake_session()
  p <- bars_proxy("chart", session = s)
  proxy_update_data(
    p,
    data.frame(site = "S1"),
    spec = list(
      mapping = list(x = "site"),
      callbacks = list(onClick = js_hook("function () {}"))
    )
  )
  args <- s$msgs[[1]]$message$args
  expect_identical(jsonlite::fromJSON(args$jsHooks), "callbacks.onClick")
})

test_that("every verb returns the proxy invisibly for piping", {
  s <- fake_session()
  p <- bars_proxy("chart", session = s)
  expect_identical(proxy_clear_selection(p), p)
  expect_invisible(proxy_clear_selection(p))
  expect_identical(
    proxy_update_data(p, data.frame(site = "S1")) |> proxy_clear_selection(),
    p
  )
})

test_that("bars_proxy() outside Shiny errors", {
  expect_error(bars_proxy("chart", session = NULL), "Shiny session")
})

test_that("proxy_update_data() rejects a partial spec {#1}", {
  s <- fake_session()
  p <- bars_proxy("chart", session = s)
  # updateData replaces the whole browser spec, so a delta must fail in R
  expect_error(
    proxy_update_data(
      p,
      data.frame(site = "S1"),
      spec = list(position = "dodge")
    ),
    "spec.mapping is required",
    fixed = TRUE
  )
  expect_length(s$msgs, 0)
  # a complete spec still goes through
  proxy_update_data(
    p,
    data.frame(site = "S1"),
    spec = list(mapping = list(x = "site"), position = "dodge")
  )
  expect_identical(s$msgs[[1]]$message$verb, "updateData")
  # proxy_update_spec() keeps delta semantics (upstream mergeDeep)
  proxy_update_spec(p, list(position = "dodge"))
  expect_identical(s$msgs[[2]]$message$verb, "updateSpec")
})
