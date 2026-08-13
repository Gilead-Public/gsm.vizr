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

        // Wrapper event contract: always dispatch gsm-viz-select (bubbling)
        // and mirror to Shiny inputs; user hooks (already revived) run after.
        var spec = input.spec;
        var userClick = spec.callbacks && spec.callbacks.onClick;
        var userSelect = spec.callbacks && spec.callbacks.onSelect;
        function emit(detail, suffix) {
          el.dispatchEvent(
            new CustomEvent('gsm-viz-select', { bubbles: true, detail: detail })
          );
          if (window.Shiny && el.id) {
            Shiny.setInputValue(el.id + suffix, detail, { priority: 'event' });
          }
        }
        spec.callbacks = Object.assign({}, spec.callbacks, {
          onClick: function (point, event) {
            emit(
              {
                type: 'click',
                chartId: el.id,
                category: spec.orientation === 'horizontal' ? point.y : point.x,
                fill: point._fill !== undefined ? point._fill : null,
                // Shape depends on stat: the aggregated rows array under
                // "count", the single contributing row under "identity".
                // Forwarded unchanged - see the event contract in the vignette.
                datum: point._datum !== undefined ? point._datum : null,
                metadata: meta
              },
              '_click'
            );
            if (userClick) userClick(point, event);
          },
          onSelect: function (selection, event) {
            emit(
              {
                type: 'select',
                chartId: el.id,
                selection: selection,
                metadata: meta
              },
              '_select'
            );
            if (userSelect) userSelect(selection, event);
          }
        });

        // facetBars reads the facet config off the spec, but it travels as its
        // own payload slot so bars() and facet_bars() share one binding.
        if (input.facet) {
          spec.facet = input.facet;
          el.gsmFacet = gsmViz.default.facetBars(el, input.data, spec);
        } else {
          el.gsmChart = gsmViz.default.bars(el, input.data, spec);
        }
      },
      resize: function (width, height) {}
    };
  }
});
