test_that("exactly one vendored gsm.viz bundle ships and it is the pinned one", {
  # A gsm.viz upgrade must REPLACE the vendored bundle, not add a second copy;
  # pinning the exact name fails loudly if a bump lands without updating assets.
  # No skip_if guard: the bundle is the only content of htmlwidgets/lib, so a
  # missing directory is the failure this test exists to catch, not a reason to
  # stand down.
  lib <- system.file("htmlwidgets", "lib", package = "gsm.vizr")
  expect_true(nzchar(lib) && dir.exists(lib))
  bundles <- grep(
    "^gsm\\.viz-",
    list.dirs(lib, full.names = FALSE, recursive = FALSE),
    value = TRUE
  )
  expect_identical(bundles, "gsm.viz-2.4.1")
})

test_that("the vendored bundle files are present and non-trivial", {
  dir <- system.file(
    "htmlwidgets",
    "lib",
    "gsm.viz-2.4.1",
    package = "gsm.vizr"
  )
  expect_true(nzchar(dir) && dir.exists(dir))
  expect_gt(file.size(file.path(dir, "index.js")), 100000)
  expect_true(file.exists(file.path(dir, "index.js.map")))
  expect_true(file.exists(file.path(dir, "main.css")))
})
