test_that("MakeChartConfig layers metric and call-level settings {#4}", {
  lMetric <- list(MetricID = "Analysis_kri0001", Metric = "AE Rate")
  lConfig <- MakeChartConfig(
    lMetric = lMetric,
    strChartFunction = "Widget_BarChart",
    y = "Score"
  )
  expect_identical(lConfig$MetricID, "Analysis_kri0001")
  expect_identical(lConfig$y, "Score")
})

test_that("MakeChartConfig rejects a non-function chart name {#4}", {
  expect_error(
    MakeChartConfig(lMetric = list(), strChartFunction = "NotARealFunction"),
    "not a valid function"
  )
})
