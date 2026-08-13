// Revive js_hook() slots: the R side sends function bodies as strings plus
// the dot-paths where they live (allowlisted in R), so eval never touches
// arbitrary spec content.
function reviveHooks(spec, paths) {
  (paths || []).forEach(function (path) {
    var keys = path.split('.');
    var parent = spec;
    for (var i = 0; i < keys.length - 1; i++) {
      parent = parent && parent[keys[i]];
    }
    var leaf = keys[keys.length - 1];
    if (parent && typeof parent[leaf] === 'string') {
      parent[leaf] = eval('(' + parent[leaf] + ')');
    }
  });
}

HTMLWidgets.widget({
  name: 'bars',
  type: 'output',
  factory: function (el, width, height) {
    return {
      renderValue: function (input) {
        if (input.bDebug) console.log(input);
        // Before any render branch: the facet path passes the same spec object
        // through to facetBars, so revival has to happen ahead of the dispatch.
        reviveHooks(input.spec, input.jsHooks);
        var meta = input.metadata || {};
        // Report pattern: a stable chartId for report-level event wiring.
        // Shiny outputs keep their outputId - do not pass chartId under Shiny.
        if (meta.chartId) el.id = meta.chartId;
        el.classList.add('gsm-vizr');
        // Container floor: dynamicSizing may set el.style.height, but it can
        // never collapse the widget below the configured minimum.
        el.style.minHeight = (input.minHeight || 0) + 'px';
        // facetBars reads the facet config off the spec, but it travels as its
        // own payload slot so bars() and facet_bars() share one binding.
        if (input.facet) {
          var spec = input.spec;
          spec.facet = input.facet;
          el.gsmFacet = gsmViz.default.facetBars(el, input.data, spec);
        } else {
          el.gsmChart = gsmViz.default.bars(el, input.data, input.spec);
        }
      },
      resize: function (width, height) {}
    };
  }
});
