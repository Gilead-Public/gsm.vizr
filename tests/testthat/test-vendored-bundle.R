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

test_that("the vendored bundle carries the Gilead-Public SiteRiskScore URL {#4}", {
  # Pinning a URL string inside a bundle looks odd, so: this bundle is the
  # gsm.viz 2.4.1 tag PLUS a patch carried over from gsm.kri#285. The tag
  # predates the Gilead-BioStats -> Gilead-Public rename, so a clean rebuild of
  # 2.4.1 silently reintroduces the old host. That string is the default
  # SiteRiskScoreURL, i.e. the SiteRiskScore help link in every KRI report, and
  # no other test in this package or in gsm.kri asserts it. Without this test an
  # unpatched bundle bump breaks a user-visible link and every other check stays
  # green. Asserting the old host is absent, not just the new one present, is
  # what makes a partially-applied patch fail too.
  index <- system.file(
    "htmlwidgets",
    "lib",
    "gsm.viz-2.4.1",
    "index.js",
    package = "gsm.vizr"
  )
  expect_true(nzchar(index) && file.exists(index))

  js <- readLines(index, warn = FALSE)
  expect_true(any(grepl(
    "https://gilead-public.github.io/gsm.kri/articles/SiteRiskScore.html",
    js,
    fixed = TRUE
  )))
  expect_length(grep("gilead-biostats.github.io", js, fixed = TRUE), 0)
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
