HTMLWidgets.widget({
  name: 'bars',
  type: 'output',
  factory: function (el, width, height) {
    return {
      renderValue: function (input) {
        if (input.bDebug) console.log(input);
        var meta = input.metadata || {};
        // Report pattern: a stable chartId for report-level event wiring.
        // Shiny outputs keep their outputId - do not pass chartId under Shiny.
        if (meta.chartId) el.id = meta.chartId;
        el.classList.add('gsm-vizr');
        // Container floor: dynamicSizing may set el.style.height, but it can
        // never collapse the widget below the configured minimum.
        el.style.minHeight = (input.minHeight || 0) + 'px';
        el.gsmChart = gsmViz.default.bars(el, input.data, input.spec);
      },
      resize: function (width, height) {}
    };
  }
});
