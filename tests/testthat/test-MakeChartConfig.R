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

test_that("MakeChartConfig resolves a key to its most specific layer {#4}", {
  # Each key below is supplied at a different depth of the four-layer stack, so the
  # expectations pin the precedence order itself: reordering the layers changes at
  # least one winner. `$` returns the first match, so the earliest layer wins.
  lConfig <- MakeChartConfig(
    lMetric = list(MetricID = "M1", keyAll = "from-metric"),
    strChartFunction = "Widget_BarChart",
    # metric-specific chart settings
    M1 = list(
      Widget_BarChart = list(
        keyAll = "from-metric-chart",
        keyMetricChart = "from-metric-chart"
      )
    ),
    # cross-metric chart settings
    Widget_BarChart = list(
      keyAll = "from-chart",
      keyMetricChart = "from-chart",
      keyChart = "from-chart"
    ),
    # cross-metric, cross-chart settings
    keyAll = "from-global",
    keyMetricChart = "from-global",
    keyChart = "from-global",
    keyGlobal = "from-global"
  )

  expect_identical(lConfig$keyAll, "from-metric")
  expect_identical(lConfig$keyMetricChart, "from-metric-chart")
  expect_identical(lConfig$keyChart, "from-chart")
  expect_identical(lConfig$keyGlobal, "from-global")
})

test_that("MakeChartConfig rejects a non-function chart name {#4}", {
  expect_error(
    MakeChartConfig(lMetric = list(), strChartFunction = "NotARealFunction"),
    "not a valid function"
  )
})
