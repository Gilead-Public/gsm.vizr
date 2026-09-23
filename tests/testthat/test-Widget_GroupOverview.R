test_that("Widget_GroupOverview creates a valid HTML widget (#4)", {
  TestAtLogLevel()
  widget <- Widget_GroupOverview(
    gsm.core::reportingResults,
    gsm.core::reportingMetrics,
    gsm.core::reportingGroups,
    strGroupLevel = "Site"
  )
  expect_s3_class(widget, c("Widget_GroupOverview", "htmlwidget"))
})

test_that("Widget_GroupOverview returns expected data (#4)", {
  TestAtLogLevel()
  widget <- Widget_GroupOverview(
    gsm.core::reportingResults,
    gsm.core::reportingMetrics,
    gsm.core::reportingGroups,
    strGroupLevel = "Site"
  )

  expect_named(
    jsonlite::fromJSON(widget$x$dfResults),
    c(
      "GroupID",
      "GroupLevel",
      "Numerator",
      "Denominator",
      "Metric",
      "Score",
      "Flag",
      "MetricID",
      "SnapshotDate",
      "StudyID",
      "Weight",
      "WeightMax"
    )
  )

  expect_s3_class(jsonlite::fromJSON(widget$x$dfGroups), "data.frame")
  expect_equal(jsonlite::fromJSON(widget$x$strGroupSubset), "red")
  expect_null(jsonlite::fromJSON(widget$x$strComparisonRiskMetric))
})

test_that("Widget_GroupOverview returns correct class (#4)", {
  widgetOutput <- Widget_GroupOverviewOutput("test")
  expect_s3_class(widgetOutput, c("shiny.tag.list", "list"))
})

test_that("Widget_GroupOverview uses correct Group or errors out when strGroupLevel is NULL (#4)", {
  TestAtLogLevel()
  widget <- Widget_GroupOverview(
    gsm.core::reportingResults,
    gsm.core::reportingMetrics,
    gsm.core::reportingGroups
  )

  sampleGroupLevel <- gsm.core::reportingMetrics$GroupLevel %>%
    unique() %>%
    jsonlite::toJSON(na = "string", auto_unbox = T)

  expect_true(grepl(sampleGroupLevel, widget$x$lConfig))
})

test_that("Widget_GroupOverview accepts an adjacent comparison risk score (#63)", {
  results <- gsm.core::reportingResults
  baseline <- results[results$MetricID == "Analysis_srs0001", , drop = FALSE]
  adjusted <- baseline
  adjusted$MetricID <- "Analysis_srs0002"
  adjusted$Score <- adjusted$Score / 2

  widget <- Widget_GroupOverview(
    dplyr::bind_rows(results, adjusted),
    gsm.core::reportingMetrics,
    gsm.core::reportingGroups,
    strGroupLevel = "Site",
    strComparisonRiskMetric = "Analysis_srs0002",
    strComparisonRiskLabel = "Adjusted Risk Score"
  )

  expect_equal(
    jsonlite::fromJSON(widget$x$strComparisonRiskMetric),
    "Analysis_srs0002"
  )
  expect_equal(
    jsonlite::fromJSON(widget$x$strComparisonRiskLabel),
    "Adjusted Risk Score"
  )
})

test_that("Widget_GroupOverview assertions works (#4)", {
  reportingResults_modified <- as.list(gsm.core::reportingResults)
  reportingMetrics_modified <- as.list(gsm.core::reportingMetrics)
  reportingGroups_modified <- as.list(gsm.core::reportingGroups)
  expect_error(
    Widget_GroupOverview(
      reportingResults_modified,
      gsm.core::reportingMetrics,
      gsm.core::reportingGroups
    ),
    "dfResults is not a data.frame"
  )
  expect_error(
    Widget_GroupOverview(
      gsm.core::reportingResults,
      reportingMetrics_modified,
      gsm.core::reportingGroups
    ),
    "dfMetrics is not a data.frame"
  )
  expect_error(
    Widget_GroupOverview(
      gsm.core::reportingResults,
      gsm.core::reportingMetrics,
      reportingGroups_modified
    ),
    "dfGroups is not a data.frame"
  )
  expect_error(
    Widget_GroupOverview(
      gsm.core::reportingResults,
      gsm.core::reportingMetrics,
      gsm.core::reportingGroups,
      strGroupSubset = 1
    ),
    "strGroupSubset is not a character"
  )
  expect_error(
    Widget_GroupOverview(
      gsm.core::reportingResults,
      gsm.core::reportingMetrics,
      gsm.core::reportingGroups,
      strGroupLabelKey = 1
    ),
    "strGroupLabelKey is not a character"
  )
  expect_error(
    Widget_GroupOverview(
      gsm.core::reportingResults,
      gsm.core::reportingMetrics,
      gsm.core::reportingGroups,
      bDebug = 1
    ),
    "bDebug is not a logical"
  )
  expect_error(
    Widget_GroupOverview(
      gsm.core::reportingResults,
      gsm.core::reportingMetrics,
      gsm.core::reportingGroups,
      strComparisonRiskMetric = 1
    ),
    "strComparisonRiskMetric is not NULL or a single non-empty character value"
  )
  expect_error(
    Widget_GroupOverview(
      gsm.core::reportingResults,
      gsm.core::reportingMetrics,
      gsm.core::reportingGroups,
      strComparisonRiskMetric = character()
    ),
    "strComparisonRiskMetric is not NULL or a single non-empty character value"
  )
  expect_error(
    Widget_GroupOverview(
      gsm.core::reportingResults,
      gsm.core::reportingMetrics,
      gsm.core::reportingGroups,
      strComparisonRiskLabel = NA_character_
    ),
    "strComparisonRiskLabel is not a single non-empty character value"
  )
})
