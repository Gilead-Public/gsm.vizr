test_that("Widget_ScatterPlot creates a valid HTML widget {#4}", {
  reportingResults_filter <- gsm.core::reportingResults %>%
    dplyr::filter(
      MetricID == "Analysis_kri0001" & SnapshotDate == max(SnapshotDate)
    )

  reportingMetrics_filter <- gsm.core::reportingMetrics %>%
    dplyr::filter(MetricID == "Analysis_kri0001") %>%
    as.list()

  widget <- Widget_ScatterPlot(
    dfResults = reportingResults_filter,
    dfGroups = gsm.core::reportingGroups,
    dfBounds = gsm.core::reportingBounds,
    lMetric = reportingMetrics_filter
  )

  expect_s3_class(widget, c("Widget_ScatterPlot", "htmlwidget"))
})

test_that("Widget_ScatterPlot assertions work {#4}", {
  expect_error(
    Widget_ScatterPlot(dfResults = "not a data frame"),
    "dfResults is not a data.frame"
  )
  expect_error(
    Widget_ScatterPlot(gsm.core::reportingResults, lMetric = mtcars),
    "lMetric must be a list, but not a data.frame"
  )
})
