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
# Separate fixture: the relocated legacy widget must be the only source of the
# gsmViz dependency on its page, which a gallery carrying bars() charts cannot
# express (htmltools de-duplicates dependencies by name+version).
rmarkdown::render(
  "tests/playwright/legacy-widgets.Rmd",
  output_file = "legacy-widgets.html",
  output_dir = "tests/playwright/fixture",
  quiet = TRUE
)
cat("Rendered tests/playwright/fixture/legacy-widgets.html\n")
