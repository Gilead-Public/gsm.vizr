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
