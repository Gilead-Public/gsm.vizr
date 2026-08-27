HTMLWidgets.widget({
    name: 'Widget_BarChart',
    type: 'output',
    factory: function(el, width, height) {
        return {
            renderValue: function(input) {
                if (input.bDebug)
                    console.log(input);

                // Coerce `input.lChartConfig` to an object if it is not already.
                if (Object.prototype.toString.call(input.lChartConfig) !== '[object Object]') {
                    input.lChartConfig = {};
                };

                // Readable data-derived id for report-level wiring - but never
                // rename a Shiny output (the outputId is what the server keys
                // on), and keep the htmlwidgets id as a suffix so repeated
                // metrics on one page stay unique.
                if (!HTMLWidgets.shinyMode) {
                    el.id = `barChart--${input.lChartConfig.MetricID}_${input.strOutcome}--${el.id}`;
                }

                // Add click event listener to chart.
                input.lChartConfig.clickCallback = clickCallback(el, input);

                // Generate bar chart.
                const instance = gsmViz.default.barChart(
                    el,
                    input.dfResults,
                    input.lChartConfig,
                    input.vThreshold,
                    input.dfGroups
                );

                // Add dropdowns that highlight group ID(s).
                const { widgetControls } = addWidgetControls(
                    el,
                    input.dfResults,
                    input.lChartConfig,
                    input.dfGroups,
                    input.bAddGroupSelect
                );

                // Add a dropdown that changes the outcome variable (only if widgetControls exists).
                if (widgetControls) {
                    const outcomeSelect = addOutcomeSelect(
                        widgetControls,
                        input.dfResults,
                        input.lChartConfig,
                        input.dfGroups,
                        input.strOutcome,
                        input.vOutcomeOptions
                    );
                }
            },
            resize: function(width, height) {
            }
        };
    }
});
