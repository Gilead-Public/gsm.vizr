test_that("barsOutput()/renderBars() are htmlwidgets Shiny bindings", {
  skip_if_not_installed("shiny")
  out <- barsOutput("chart")
  expect_s3_class(out, "shiny.tag.list")
  expect_match(as.character(out), 'id="chart"')
  r <- renderBars(bars(data.frame(site = "S1"), bars_spec(x = "site")))
  expect_true(is.function(r))
})

test_that("barsOutput() carries the vendored gsm.viz bundle as a dependency", {
  # Under Shiny nothing else attaches the bundle: knitr picks it up from the
  # widget's own dependencies, but an app only ever sees the output stub. A
  # missing dependency here is a blank chart in every Shiny consumer.
  skip_if_not_installed("shiny")
  deps <- htmltools::findDependencies(barsOutput("chart"))
  names <- vapply(deps, function(d) d$name, character(1))
  expect_true("gsmViz" %in% names)
  expect_identical(deps[[which(names == "gsmViz")[1]]]$version, "2.4.1")
})

test_that("barsOutput() honours width and height", {
  skip_if_not_installed("shiny")
  html <- as.character(barsOutput("chart", width = "640px", height = "320px"))
  expect_match(html, "width:640px", fixed = TRUE)
  expect_match(html, "height:320px", fixed = TRUE)
})
