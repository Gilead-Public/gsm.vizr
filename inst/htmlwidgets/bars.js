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

// No reveal/resize hook here on purpose. Charts rendered inside hidden
// containers come out correctly sized on reveal in both environments that
// matter, measured across plain, faceted and dynamicSizing charts: static
// rmarkdown tabsets (htmlwidgets writes explicit dimensions, so Chart.js never
// measures the collapsed parent) and Shiny tabPanels (Chart.js's own responsive
// handling resizes on reveal). See tests/playwright/layout.spec.js and the
// hidden-tab test in tests/playwright/shiny.spec.js, which assert the chart
// agrees with its revealed container rather than merely reporting a non-zero
// width. If a container is ever found where this does break, the fix belongs in
// the binding's resize() - htmlwidgets calls it on reveal - not in an
// IntersectionObserver, which would not fire for a pane revealed off-screen.

if (window.Shiny) {
  Shiny.addCustomMessageHandler('gsm-vizr-proxy', function (msg) {
    var el = document.getElementById(msg.id);
    // Facet widgets store el.gsmFacet, not el.gsmChart. Returning quietly here
    // would make every proxy verb a no-op with nothing in the console - fail
    // loudly instead; facet proxy support is deferred past 0.1.0.
    if (el && el.gsmFacet) {
      throw new Error(
        'gsm.vizr: proxy verb "' +
          msg.verb +
          '" is not supported on the faceted widget "' +
          msg.id +
          '" (bars() widgets only in 0.1.0)'
      );
    }
    var ch = el && el.gsmChart;
    if (!ch) return;
    var h = ch.helpers;
    var a = msg.args || {};
    var opts = { _silent: a.silent !== false };
    // Revive js_hook() slots on updates exactly as renderValue does on first
    // render; without this a hook sent by proxy stays a string and upstream
    // rejects it.
    if (a.spec) reviveHooks(a.spec, a.jsHooks);
    switch (msg.verb) {
      case 'updateData':
        // No spec sent -> reuse the live spec: the browser copy is
        // authoritative after positionToggle/nCategoriesToggle mutations.
        h.updateData(ch, a.data, a.spec != null ? a.spec : ch.data._spec_);
        break;
      case 'updateSpec':
        h.updateSpec(ch, a.spec);
        break;
      case 'selectCategory':
        h.selectCategory(ch, a.values, undefined, opts);
        break;
      case 'selectSegment':
        h.selectSegment(ch, a.values, undefined, opts);
        break;
      case 'clearSelection':
        h.clearSelection(ch, undefined, opts);
        break;
      case 'exportImage':
        h.exportImage(ch, a.filename != null ? a.filename : undefined);
        break;
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
