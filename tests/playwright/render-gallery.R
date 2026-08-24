# Renders the golden-gallery fixture for the Playwright specs.
# Run from the package root: Rscript tests/playwright/render-gallery.R
devtools::load_all(".", quiet = TRUE)
dir.create("tests/playwright/fixture", showWarnings = FALSE, recursive = TRUE)
rmarkdown::render(
  "tests/playwright/gallery.Rmd",
  output_file = "gallery.html",
  output_dir = "tests/playwright/fixture",
  quiet = TRUE
)
cat("Rendered tests/playwright/fixture/gallery.html\n")
# Separate fixture: the tabset case needs a chart that starts inside a hidden
# pane, which cannot be expressed on a single-page gallery.
rmarkdown::render(
  "tests/playwright/tabset.Rmd",
  output_file = "tabset.html",
  output_dir = "tests/playwright/fixture",
  quiet = TRUE
)
cat("Rendered tests/playwright/fixture/tabset.html\n")
