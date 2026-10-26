test_that("html_dependency_gsm_viz() points at the vendored bundle", {
  dep <- html_dependency_gsm_viz()
  expect_s3_class(dep, "html_dependency")
  expect_identical(dep$name, "gsmViz")
  expect_identical(dep$version, "2.4.1")
  expect_identical(dep$script, "index.js")
  expect_identical(dep$stylesheet, "main.css")
})

test_that("the dependency resolves to files that actually exist", {
  # The point of this export is that other packages stop vendoring the bundle;
  # a src path that does not resolve would fail in their reports, not ours.
  dep <- html_dependency_gsm_viz()
  dir <- dep$src[["file"]]
  expect_true(nzchar(dir) && dir.exists(dir))
  expect_true(file.exists(file.path(dir, dep$script)))
  expect_true(file.exists(file.path(dir, dep$stylesheet)))
})

test_that("the dependency version tracks the vendored bundle directory", {
  # Bumping the bundle without bumping this version would silently serve 2.4.1
  # assets under a stale cache key.
  dep <- html_dependency_gsm_viz()
  expect_identical(basename(dep$src[["file"]]), paste0("gsm.viz-", dep$version))
})
