tiles_df <- function() {
  data.frame(
    subjid = c("P1", "P1", "P2"),
    vital = c("Pulse", "SBP", "Pulse"),
    flag = c("Red", NA, "Green"),
    rate = c(0.5, NA, 0.25)
  )
}

tiles_expand <- function() {
  data.frame(
    subjid = c("P1", "P1", "P2"),
    vital = "Pulse",
    seq = c(1L, 2L, 1L),
    inWindow = c(FALSE, TRUE, NA),
    value = c(72, 75, NA)
  )
}

tiles_spec <- function(...) {
  utils::modifyList(
    list(mapping = list(x = "vital", y = "subjid", fill = "flag")),
    list(...)
  )
}

test_that("tiles() returns a gsm.vizr htmlwidget with json-classed payload {#11}", {
  w <- tiles(tiles_df(), tiles_spec())
  expect_s3_class(w, "tiles")
  expect_s3_class(w, "htmlwidget")
  for (slot in c("data", "spec", "jsHooks", "metadata")) {
    expect_s3_class(w$x[[slot]], "json")
  }
  expect_null(w$x$expandData)
  expect_false(w$x$bDebug)
  expect_true(tiles(tiles_df(), tiles_spec(), bDebug = TRUE)$x$bDebug)
  expect_match(
    as.character(w$x$spec),
    '"mapping":{"x":"vital","y":"subjid","fill":"flag"}',
    fixed = TRUE
  )
})

test_that("tiles() validates data, spec and metadata {#11}", {
  df <- tiles_df()
  expect_error(tiles(as.list(df), tiles_spec()), "data must be a data.frame")
  expect_error(tiles(df, "nope"), "spec must be a list")
  expect_error(tiles(df, df), "spec must be a list")
  expect_error(tiles(df, tiles_spec(), metadata = "x"), "metadata must be a list")
  expect_error(tiles(df, tiles_spec(), metadata = df), "metadata must be a list")
  expect_error(
    tiles(df, tiles_spec(), metadata = list("a")),
    "metadata must be a named list",
    fixed = TRUE
  )
})

test_that("tiles() requires mapping x and y naming columns of data {#11}", {
  df <- tiles_df()
  expect_error(tiles(df, list()), "spec.mapping.x is required", fixed = TRUE)
  expect_error(
    tiles(df, list(mapping = list(x = "vital"))),
    "spec.mapping.y is required",
    fixed = TRUE
  )
  expect_error(
    tiles(df, list(mapping = list(x = c("vital", "flag"), y = "subjid"))),
    "spec.mapping.x is required",
    fixed = TRUE
  )
  expect_error(
    tiles(df, list(mapping = list(x = "nope", y = "subjid"))),
    'spec.mapping.x ("nope") is not a column of data',
    fixed = TRUE
  )
  expect_error(
    tiles(df, list(mapping = list(x = "vital", y = "nope"))),
    'spec.mapping.y ("nope") is not a column of data',
    fixed = TRUE
  )
})

test_that("tiles() validates spec$expand {#11}", {
  df <- tiles_df()
  expect_error(
    tiles(df, tiles_spec(expand = "x")),
    "spec.expand must be a list",
    fixed = TRUE
  )
  expect_error(
    tiles(df, tiles_spec(expand = list(mapping = list(x = "seq")))),
    "spec.expand.data must be a data.frame",
    fixed = TRUE
  )
  expect_error(
    tiles(df, tiles_spec(expand = list(data = list(a = 1), mapping = list(x = "seq")))),
    "spec.expand.data must be a data.frame",
    fixed = TRUE
  )
  expect_error(
    tiles(df, tiles_spec(expand = list(data = tiles_expand()))),
    "spec.expand.mapping.x is required",
    fixed = TRUE
  )
  ex <- tiles_expand()
  ex$vital <- NULL
  expect_error(
    tiles(df, tiles_spec(expand = list(data = ex, mapping = list(x = "seq")))),
    'spec.expand.data must contain the columns "vital", "subjid", "seq" (missing: "vital")',
    fixed = TRUE
  )
  expect_error(
    tiles(df, tiles_spec(expand = list(data = tiles_expand(), mapping = list(x = "nope")))),
    '(missing: "nope")',
    fixed = TRUE
  )
})

test_that("data travels column-wise with NA as null {#11}", {
  w <- tiles(tiles_df(), tiles_spec())
  json <- as.character(w$x$data)
  expect_identical(
    json,
    paste0(
      '{"subjid":["P1","P1","P2"],"vital":["Pulse","SBP","Pulse"],',
      '"flag":["Red",null,"Green"],"rate":[0.5,null,0.25]}'
    )
  )
  # Column-wise means no per-row objects.
  expect_no_match(json, "[{", fixed = TRUE)
  expect_no_match(json, '"NA"', fixed = TRUE)
})

test_that("a one-row data.frame still arrives as arrays {#11}", {
  df <- data.frame(subjid = "P1", vital = factor("Pulse"), n = NA_real_)
  json <- as.character(tiles(df, tiles_spec(mapping = list(fill = NULL)))$x$data)
  expect_identical(json, '{"subjid":["P1"],"vital":["Pulse"],"n":[null]}')
})

test_that("expand data travels column-wise in its own slot {#11}", {
  w <- tiles(
    tiles_df(),
    tiles_spec(
      expand = list(
        data = tiles_expand(),
        mapping = list(x = "seq", fill = "inWindow", label = "value"),
        initial = "Pulse"
      )
    )
  )
  expect_s3_class(w$x$expandData, "json")
  expect_identical(
    as.character(w$x$expandData),
    paste0(
      '{"subjid":["P1","P1","P2"],"vital":["Pulse","Pulse","Pulse"],',
      '"seq":[1,2,1],"inWindow":[false,true,null],"value":[72,75,null]}'
    )
  )
  spec <- as.character(w$x$spec)
  # Removed from the spec rather than sent twice; the rest of expand stays.
  expect_no_match(spec, '"data"', fixed = TRUE)
  expect_match(
    spec,
    '"expand":{"mapping":{"x":"seq","fill":"inWindow","label":"value"}',
    fixed = TRUE
  )
  # Upstream rejects a non-array expand.initial.
  expect_match(spec, '"initial":["Pulse"]', fixed = TRUE)
})

test_that("expand data with a single row still arrives as arrays {#11}", {
  ex <- tiles_expand()[1, ]
  w <- tiles(tiles_df(), tiles_spec(expand = list(data = ex, mapping = list(x = "seq"))))
  expect_match(as.character(w$x$expandData), '"seq":[1]', fixed = TRUE)
})

test_that("one-value orders stay arrays and absent ones are not invented {#11}", {
  w <- tiles(
    tiles_df(),
    tiles_spec(
      scales = list(
        x = list(order = "Pulse"),
        y = list(order = factor("P2")),
        fill = list(order = "Red", colors = list(Red = "#FF5859"))
      ),
      expand = list(
        data = tiles_expand(),
        mapping = list(x = "seq"),
        scales = list(fill = list(order = "TRUE"))
      )
    )
  )
  spec <- as.character(w$x$spec)
  expect_match(spec, '"x":{"order":["Pulse"]}', fixed = TRUE)
  expect_match(spec, '"y":{"order":["P2"]}', fixed = TRUE)
  expect_match(spec, '"order":["Red"]', fixed = TRUE)
  expect_match(spec, '"order":["TRUE"]', fixed = TRUE)
  expect_match(spec, '"colors":{"Red":"#FF5859"}', fixed = TRUE)

  minimal <- as.character(tiles(tiles_df(), tiles_spec())$x$spec)
  expect_no_match(minimal, "scales", fixed = TRUE)
  expect_no_match(minimal, "expand", fixed = TRUE)
})

test_that("metadata (incl. chartId) serializes as an object {#11}", {
  expect_identical(
    as.character(tiles(tiles_df(), tiles_spec())$x$metadata),
    "{}"
  )
  w <- tiles(tiles_df(), tiles_spec(), metadata = list(chartId = "rm-tiles", level = "subject"))
  expect_identical(
    as.character(w$x$metadata),
    '{"chartId":"rm-tiles","level":"subject"}'
  )
})

test_that("js_hook() slots are extracted for every allowlisted tiles path {#11}", {
  w <- tiles(
    tiles_df(),
    tiles_spec(
      tooltip = list(formatter = js_hook("function (row) { return row.subjid; }")),
      expand = list(
        data = tiles_expand(),
        mapping = list(x = "seq"),
        tooltip = list(formatter = js_hook("function (row) { return 'd'; }"))
      ),
      callbacks = list(
        onClick = js_hook("function (d) {}"),
        onRowClick = js_hook("function (info) {}"),
        onExpand = js_hook("function (x, expanded) {}")
      )
    )
  )
  hooks <- jsonlite::fromJSON(w$x$jsHooks)
  expect_setequal(
    hooks,
    c(
      "tooltip.formatter",
      "expand.tooltip.formatter",
      "callbacks.onClick",
      "callbacks.onRowClick",
      "callbacks.onExpand"
    )
  )
  spec <- jsonlite::fromJSON(w$x$spec, simplifyVector = TRUE)
  expect_identical(spec$tooltip$formatter, "function (row) { return row.subjid; }")
  expect_identical(spec$callbacks$onRowClick, "function (info) {}")
  expect_identical(spec$expand$tooltip$formatter, "function (row) { return 'd'; }")
})

test_that("no hooks serializes an empty array {#11}", {
  expect_identical(as.character(tiles(tiles_df(), tiles_spec())$x$jsHooks), "[]")
})

test_that("js_hook() outside the tiles allowlist errors {#11}", {
  # onHover is a bars slot, not a tiles one.
  expect_error(
    tiles(tiles_df(), tiles_spec(callbacks = list(onHover = js_hook("function () {}")))),
    "js_hook() is only supported at: tooltip.formatter, expand.tooltip.formatter",
    fixed = TRUE
  )
  expect_error(
    tiles(tiles_df(), tiles_spec(theme = list(x = js_hook("function () {}")))),
    "found at theme.x",
    fixed = TRUE
  )
})

test_that("tiles.yaml declares the vendored gsmViz bundle like bars.yaml {#11}", {
  yaml_deps <- function(name) {
    path <- system.file("htmlwidgets", paste0(name, ".yaml"), package = "gsm.vizr")
    lines <- readLines(path, warn = FALSE)
    trimws(lines[nzchar(trimws(lines))])
  }
  expect_identical(yaml_deps("tiles"), yaml_deps("bars"))

  deps <- htmltools::findDependencies(
    htmltools::as.tags(tiles(tiles_df(), tiles_spec()))
  )
  names <- vapply(deps, function(d) d$name, character(1))
  gsm <- deps[[which(names == "gsmViz")[1]]]
  ref <- html_dependency_gsm_viz()
  expect_identical(gsm$version, ref$version)
  expect_identical(basename(gsm$src$file), basename(ref$src[["file"]]))
  expect_identical(gsm$script, "index.js")
  expect_identical(gsm$stylesheet, "main.css")
  expect_true("tiles-binding" %in% names)
})

test_that("tilesOutput()/renderTiles() are htmlwidgets Shiny bindings {#11}", {
  skip_if_not_installed("shiny")
  out <- tilesOutput("rm")
  expect_s3_class(out, "shiny.tag.list")
  html <- as.character(out)
  expect_match(html, 'id="rm"')
  expect_match(html, "class=\"tiles html-widget", fixed = TRUE)
  expect_match(html, "width:100%", fixed = TRUE)
  expect_match(html, "height:auto", fixed = TRUE)
  expect_match(
    as.character(tilesOutput("rm", width = "640px", height = "320px")),
    "width:640px;height:320px;",
    fixed = TRUE
  )
  deps <- htmltools::findDependencies(out)
  names <- vapply(deps, function(d) d$name, character(1))
  expect_true(all(c("gsmViz", "tiles-binding") %in% names))
  expect_identical(
    deps[[which(names == "gsmViz")[1]]]$version,
    html_dependency_gsm_viz()$version
  )

  r <- renderTiles(tiles(tiles_df(), tiles_spec()))
  expect_true(is.function(r))
  q <- renderTiles(quote(tiles(tiles_df(), tiles_spec())), quoted = TRUE)
  expect_true(is.function(q))
})
