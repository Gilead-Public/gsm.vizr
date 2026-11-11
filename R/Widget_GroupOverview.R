#' Group Overview Widget
#'
#' @description
#' `r lifecycle::badge("stable")`
#'
#' A widget that generates a group overview table of group-level metric results across one or more
#' metrics.
#'
#' @inheritParams shared-params
#' @param strGroupLevel `character` Value for the group level. Default: NULL and taken from `dfMetrics$GroupLevel` if available.
#' @param strGroupSubset `character` Subset of groups to include in the table. Default: 'red'. Options:
#' - 'all': All groups.
#' - 'red': Groups with 1+ red flags.
#' - 'red/amber': Groups with 1+ red/amber flag.
#' - 'amber': Groups with 1+ amber flag.
#' @param strGroupLabelKey `character` Value for the group label key. Default: 'InvestigatorLastName'.
#' @param strSiteRiskMetric `character` Metric ID for the site risk score. Default: 'Analysis_srs0001'.
#' @param strComparisonRiskMetric `character` Optional metric ID for a second
#'   risk score displayed immediately after the site risk score.
#' @param strComparisonRiskLabel `character` Label for the comparison risk score
#'   column. Default: 'Adjusted Risk Score'.
#' @param dfComparisonRiskDetail `data.frame` Optional per-KRI detail behind the
#'   comparison risk score, such as `gsm.kri::MakeActionRiskScoreDetail()`.
#'   Requires columns `GroupID`, `MetricID`, `Weight`, `EffectiveWeight`, and
#'   `ActionState`; `Flag` and `ActionSnapshotDate` are shown when present.
#'   When supplied, clicking a score in the second risk score column opens a
#'   row under that group listing its KRIs, their action state, and whether
#'   each counts toward the score. Ignored when the second metric is absent
#'   from `dfResults`. Default: NULL.
#'   Dated detail with `ActionWindowDays`, `DaysSinceAction`,
#'   and `LastActionedDate` adds a pale state-colored background tint to each site/KRI
#'   cell with an action recorded 0 through 90 days before the assessment date.
#'   Closed Action uses pale green, Open Action pale red, and other/previous states pale grey.
#'   A 3px inset border uses bright green for Closed, bright red for Open,
#'   and dark grey otherwise, without changing cell dimensions.
#'   The original KRI hover details are retained; only the final action line
#'   shows the same latest state, date, and age as the dropdown. This recency indicator is
#'   independent of decision coverage and does not imply risk resolution.
#'   A single "Highlight actions within 90 days" checkbox, on by default,
#'   toggles the border and tint, restoring the original styling when off.
#'   All matrix cells remain visible. The expanded breakdown includes KRIs
#'   flagged or actioned in any snapshot within the inclusive 90-day history,
#'   including findings that are now green and historical-only results.
#'   `dfResultsHistory` supplies flag snapshots; explicit action dates supply
#'   action recency. Items with neither recent evidence are omitted.
#'   There are no window, hide, or score-exclusion controls; reported scores,
#'   flag colors, and contribution fields are never changed by the widget.
#'   Highlighting survives sorting and redraws. The dated breakdown has six columns:
#'   KRI, Flag, Action state, Last Addressed, Days Ago, and Counted. Its Flag is
#'   the latest flagged value in the window, or the reviewed flag for a recent
#'   action; the main matrix keeps the current flag. Counted reflects the
#'   unchanged reported contribution. Rows sort by newest Last Addressed date,
#'   then descending absolute displayed flag, then natural KRI number; undated
#'   rows come last. The tooltip retains the flag snapshot,
#'   current flag, assessment/extraction dates, and date provenance. There is
#'   a Download CSV button exporting review rows across all supplied sites,
#'   independent of table filters, the expanded site, and highlighting.
#'   Schema version 1 contains stable IDs, current/review flags, ISO dates,
#'   action provenance, weights, exclusion reasons, and full-precision reported
#'   scores with their numerators/denominators. Missing values are blank.
#'   UTF-8 CSV uses quoted text, escaped quotes, CRLF records, and a BOM;
#'   potentially executable spreadsheet text is apostrophe-prefixed. Export
#'   never recalculates scores or changes the supplied detail.
#' @param ... `any` Additional chart configuration settings.
#' @param dfResultsHistory Optional persisted results across snapshots. Used
#'   only for dated drilldown flag history within 90 days of its assessment
#'   date; defaults to `dfResults`. Does not recalculate reported scores.
#'
#' @examples
#' # site-level report
#' Widget_GroupOverview(
#'   dfResults = dplyr::filter(gsm.core::reportingResults, SnapshotDate == max(SnapshotDate)),
#'   dfMetrics = gsm.core::reportingMetrics,
#'   dfGroups = gsm.core::reportingGroups
#' )
#'
#' # filter site-level report to all flags
#' Widget_GroupOverview(
#'   dfResults = dplyr::filter(gsm.core::reportingResults, SnapshotDate == max(SnapshotDate)),
#'   dfMetrics = gsm.core::reportingMetrics,
#'   dfGroups = gsm.core::reportingGroups,
#'   strGroupSubset = "all"
#' )
#'
#' # country-level report
#' reportingMetrics <- gsm.core::reportingMetrics
#' reportingMetrics$GroupLevel <- "Country"
#' Widget_GroupOverview(
#'   dfResults = dplyr::filter(gsm.core::reportingResults, SnapshotDate == max(SnapshotDate)),
#'   dfMetrics = gsm.core::reportingMetrics,
#'   dfGroups = gsm.core::reportingGroups,
#'   strGroupLevel = "Country"
#' )
#'
#' # add a second score beside the existing Site Risk Score when available
#' \dontrun{
#' Widget_GroupOverview(
#'   dfResults = results_with_srs0002,
#'   dfMetrics = gsm.core::reportingMetrics,
#'   dfGroups = gsm.core::reportingGroups,
#'   strComparisonRiskMetric = "Analysis_srs0002"
#' )
#' }
#'
#' @export

Widget_GroupOverview <- function(
  dfResults,
  dfMetrics,
  dfGroups,
  strGroupLevel = NULL,
  strGroupSubset = "red",
  strGroupLabelKey = "InvestigatorLastName",
  strSiteRiskMetric = "Analysis_srs0001",
  strComparisonRiskMetric = NULL,
  strComparisonRiskLabel = "Adjusted Risk Score",
  dfComparisonRiskDetail = NULL,
  strOutputLabel = paste0(
    fontawesome::fa("table", fill = "#337ab7"),
    "  ",
    strGroupLevel,
    " Overview"
  ),
  bDebug = FALSE,
  dfResultsHistory = NULL,
  ...
) {
  gsm.core::stop_if(
    cnd = !is.data.frame(dfResults),
    "dfResults is not a data.frame"
  )
  gsm.core::stop_if(
    cnd = !is.data.frame(dfMetrics),
    "dfMetrics is not a data.frame"
  )
  gsm.core::stop_if(
    cnd = !is.data.frame(dfGroups),
    "dfGroups is not a data.frame"
  )
  gsm.core::stop_if(
    cnd = !is.character(strGroupSubset),
    "strGroupSubset is not a character"
  )
  gsm.core::stop_if(
    cnd = !is.character(strGroupLabelKey) && !is.null(strGroupLabelKey),
    "strGroupLabelKey is not a character or NULL"
  )
  gsm.core::stop_if(
    cnd = !is.null(strComparisonRiskMetric) &&
      (!is.character(strComparisonRiskMetric) ||
        length(strComparisonRiskMetric) != 1L ||
        is.na(strComparisonRiskMetric) ||
        !nzchar(strComparisonRiskMetric)),
    "strComparisonRiskMetric is not NULL or a single non-empty character value"
  )
  gsm.core::stop_if(
    cnd = !is.character(strComparisonRiskLabel) ||
      length(strComparisonRiskLabel) != 1L ||
      is.na(strComparisonRiskLabel) ||
      !nzchar(strComparisonRiskLabel),
    "strComparisonRiskLabel is not a single non-empty character value"
  )
  gsm.core::stop_if(
    cnd = !is.null(dfComparisonRiskDetail) &&
      (!is.data.frame(dfComparisonRiskDetail) ||
        !all(c("GroupID", "MetricID", "Weight", "EffectiveWeight", "ActionState") %in%
          names(dfComparisonRiskDetail))),
    "dfComparisonRiskDetail is not NULL or a data.frame with GroupID, MetricID, Weight, EffectiveWeight, and ActionState columns"
  )
  gsm.core::stop_if(cnd = !is.logical(bDebug), "bDebug is not a logical")

  # set strGroupLevel if NULL and dfMetrics is not NULL
  if (is.null(strGroupLevel) && !is.null(dfMetrics)) {
    strGroupLevel <- unique(dfMetrics$GroupLevel)
  }

  gsm.core::stop_if(
    cnd = (is.null(strGroupLevel) || length(strGroupLevel) != 1),
    message = "A single group level must be provided to create group-level output."
  )

  ## don't include site risk score in dfMetrics, so it's not in the summary charts
  dfMetrics <- dfMetrics %>%
    dplyr::filter(
      !.data$MetricID %in% c(strSiteRiskMetric, strComparisonRiskMetric)
    )

  ## update dfResults to include site risk weights when available
  if (any(!is.na(dfMetrics$RiskScoreWeight))) {
    dfWeights <- dfMetrics %>%
      filter(!is.na(.data$RiskScoreWeight)) %>%
      mutate(
        Weight = map(.data$RiskScoreWeight, \(x) {
          gsm.core::ParseThreshold(x, bSort = FALSE)
        }),
        Flag = map(.data$Flag, \(x) gsm.core::ParseThreshold(x, bSort = FALSE)),
        WeightMax = map_dbl(.data$Weight, ~ max(.x, na.rm = TRUE))
      ) %>%
      select("MetricID", "Flag", "Weight", "WeightMax") %>%
      unnest(cols = c("Flag", "Weight"))

    dfResults <- dfResults %>%
      left_join(dfWeights, by = c("Flag", "MetricID"))
  }

  # Detail only explains a comparison score that is actually displayed.
  if (is.null(strComparisonRiskMetric) ||
      !strComparisonRiskMetric %in% dfResults$MetricID) {
    dfComparisonRiskDetail <- NULL
  }

  if (!is.null(dfComparisonRiskDetail) && nrow(dfComparisonRiskDetail) > 0L &&
    "ActionWindowDays" %in% names(dfComparisonRiskDetail) &&
    (!is.null(dfResultsHistory) ||
      !all(c("LastFlaggedDate", "LastFlaggedFlag", "DaysSinceFlag") %in% names(dfComparisonRiskDetail)))) {
    history <- if (is.null(dfResultsHistory)) dfResults else dfResultsHistory
    history_columns <- c("GroupID", "MetricID", "SnapshotDate", "Flag")
    gsm.core::stop_if(
      cnd = !is.data.frame(history) || !all(history_columns %in% names(history)) ||
        !inherits(history$SnapshotDate, "Date") || !is.numeric(history$Flag),
      "dfResultsHistory must contain GroupID, MetricID, Date SnapshotDate, and numeric Flag"
    )
    assessment <- if ("ActionAsOfDate" %in% names(dfComparisonRiskDetail)) {
      assessment_dates <- as.Date(dfComparisonRiskDetail$ActionAsOfDate)
      unique(assessment_dates[!is.na(assessment_dates)])
    } else {
      max(as.Date(dfResults$SnapshotDate), na.rm = TRUE)
    }
    gsm.core::stop_if(
      cnd = length(assessment) != 1L || is.na(assessment) || !is.finite(as.numeric(assessment)),
      "Dated drilldown requires one non-missing assessment date"
    )
    if ("GroupLevel" %in% names(history)) history <- history[history$GroupLevel == strGroupLevel, ]
    if ("StudyID" %in% names(history) && "StudyID" %in% names(dfResults)) {
      history <- history[history$StudyID %in% unique(dfResults$StudyID), ]
    }
    join_keys <- intersect(
      c("StudyID", "GroupLevel", "GroupID", "MetricID"),
      intersect(names(history), names(dfComparisonRiskDetail))
    )
    flagged <- history %>%
      dplyr::filter(
        !is.na(.data$Flag), is.finite(.data$Flag), .data$Flag != 0,
        .data$SnapshotDate <= assessment, .data$SnapshotDate >= assessment - 90,
        .data$SnapshotDate <= max(dfResults$SnapshotDate, na.rm = TRUE)
      ) %>%
      dplyr::group_by(dplyr::across(dplyr::all_of(join_keys))) %>%
      dplyr::slice_max(.data$SnapshotDate, n = 1L, with_ties = FALSE) %>%
      dplyr::ungroup() %>%
      dplyr::select(dplyr::all_of(join_keys), LastFlaggedDate = "SnapshotDate", LastFlaggedFlag = "Flag") %>%
      dplyr::mutate(DaysSinceFlag = as.integer(assessment - .data$LastFlaggedDate))
    dfComparisonRiskDetail <- dfComparisonRiskDetail %>%
      dplyr::select(-dplyr::any_of(c("LastFlaggedDate", "LastFlaggedFlag", "DaysSinceFlag"))) %>%
      dplyr::mutate(HasCurrentDetail = TRUE) %>%
      dplyr::full_join(flagged, by = join_keys) %>%
      dplyr::mutate(
        Weight = dplyr::if_else(is.na(.data$HasCurrentDetail), 0, .data$Weight),
        EffectiveWeight = dplyr::if_else(is.na(.data$HasCurrentDetail), 0, .data$EffectiveWeight),
        ActionState = dplyr::coalesce(.data$ActionState, "Not recorded"),
        ActionWindowDays = dplyr::coalesce(.data$ActionWindowDays, 90)
      ) %>%
      dplyr::select(-"HasCurrentDetail")
    dfComparisonRiskDetail$ActionAsOfDate <- assessment
  }

  # forward options using x
  lInput <- list(
    dfResults = dfResults,
    dfMetrics = dfMetrics,
    dfGroups = dfGroups,
    lConfig = c(
      list(
        GroupLevel = strGroupLevel,
        groupLabelKey = strGroupLabelKey
      ),
      list(...) # additional chart configuration
    ),
    strGroupLevel = strGroupLevel,
    strGroupSubset = strGroupSubset,
    strGroupLabelKey = strGroupLabelKey,
    strSiteRiskMetric = strSiteRiskMetric,
    strComparisonRiskMetric = strComparisonRiskMetric,
    strComparisonRiskLabel = strComparisonRiskLabel,
    dfComparisonRiskDetail = dfComparisonRiskDetail,
    strDownloadIcon = as.character(fontawesome::fa("download")),
    bDebug = bDebug
  )

  # create widget
  lWidget <- htmlwidgets::createWidget(
    name = "Widget_GroupOverview",
    purrr::map(
      lInput,
      ~ jsonlite::toJSON(
        .x,
        null = "null",
        na = "string",
        auto_unbox = TRUE
      )
    ),
    width = "100%",
    package = "gsm.vizr"
  )

  base::attr(lWidget, "output_label") <- strOutputLabel

  if (bDebug) {
    viewer <- getOption("viewer")
    options(viewer = NULL)
    print(lWidget)
    options(viewer = viewer)
  }

  return(lWidget)
}

#' Shiny bindings for Widget_GroupOverview
#'
#' @description
#' `r lifecycle::badge("stable")`
#'
#' Output and render functions for using Widget_GroupOverview within Shiny
#' applications and interactive Rmd documents.
#'
#' @param outputId output variable to read from
#' @param width,height Must be a valid CSS unit (like \code{'100\%'},
#'   \code{'400px'}, \code{'auto'}) or a number, which will be coerced to a
#'   string and have \code{'px'} appended.
#' @param expr An expression that generates a Widget_GroupOverview
#' @param env The environment in which to evaluate \code{expr}.
#' @param quoted Is \code{expr} a quoted expression (with \code{quote()})? This
#'   is useful if you want to save an expression in a variable.
#'
#' @name Widget_GroupOverview-shiny
#'
#' @export
Widget_GroupOverviewOutput <- function(
  outputId,
  width = "100%",
  height = "400px"
) {
  htmlwidgets::shinyWidgetOutput(
    outputId,
    "Widget_GroupOverview",
    width,
    height,
    package = "gsm.vizr"
  )
}

#' @rdname Widget_GroupOverview-shiny
#' @export
renderWidget_GroupOverview <- function(
  expr,
  env = parent.frame(),
  quoted = FALSE
) {
  if (!quoted) {
    expr <- substitute(expr)
  } # force quoted
  htmlwidgets::shinyRenderWidget(
    expr,
    Widget_GroupOverviewOutput,
    env,
    quoted = TRUE
  )
}
