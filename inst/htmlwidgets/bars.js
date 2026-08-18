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

// Install the wrapper event contract (dispatch gsm-viz-select, mirror to
// Shiny inputs, then run any user hook) onto a spec. Called at first render
// AND for every spec that travels through a proxy verb: upstream updateData
// rebuilds _spec_ from the supplied spec, and updateSpec replaces any
// callback the delta carries - either way the glue must be re-composed.
// onlyKeys limits composition to the callbacks a delta actually carries, so
// an updateSpec delta without onSelect cannot clobber the live wrapper.
function composeEventCallbacks(el, spec, meta, onlyKeys) {
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
  function orientation() {
    var live = el.gsmChart && el.gsmChart.data && el.gsmChart.data._spec_;
    return (live || spec).orientation === 'horizontal';
  }
  var wrappers = {
    onClick: function (point, event) {
      emit(
        {
          type: 'click',
          chartId: el.id,
          category: orientation() ? point.y : point.x,
          fill: point._fill !== undefined ? point._fill : null,
          // Shape depends on stat: the aggregated rows array under "count",
          // the single contributing row under "identity". Forwarded
          // unchanged - see the event contract in the vignette.
          datum: point._datum !== undefined ? point._datum : null,
          metadata: meta
        },
        '_click'
      );
      if (userClick) userClick(point, event);
    },
    onSelect: function (selection, event) {
      emit(
        { type: 'select', chartId: el.id, selection: selection, metadata: meta },
        '_select'
      );
      if (userSelect) userSelect(selection, event);
    }
  };
  spec.callbacks = spec.callbacks || {};
  Object.keys(wrappers).forEach(function (k) {
    if (!onlyKeys || onlyKeys.indexOf(k) !== -1) spec.callbacks[k] = wrappers[k];
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
    if (a.spec) {
      var deltaKeys =
        msg.verb === 'updateSpec' && a.spec.callbacks
          ? Object.keys(a.spec.callbacks)
          : null;
      if (msg.verb === 'updateData' || deltaKeys) {
        composeEventCallbacks(el, a.spec, el.gsmMeta || {}, deltaKeys);
      }
    }
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
        // A reactive output can swap bars() <-> facet_bars() under one
        // binding. Destroy whatever the previous render left so the new
        // renderer starts from a clean element; without this the old
        // grid/canvas and the stale gsmChart/gsmFacet handle survive.
        if (el.gsmChart) {
          el.gsmChart.destroy();
          delete el.gsmChart;
        }
        if (el.gsmFacet) {
          (el.gsmFacet.charts || []).forEach(function (c) {
            if (c && c.destroy) c.destroy();
          });
          delete el.gsmFacet;
        }
        el.innerHTML = '';
        var meta = input.metadata || {};
        // Report pattern: a stable chartId for report-level event wiring.
        // Under Shiny the outputId is load-bearing: the proxy handler resolves
        // its target with getElementById(outputId), and the event glue derives
        // input$<id>_click/_select from it. Renaming the element there breaks
        // both silently - the proxy message finds nothing and returns, and the
        // inputs are written under an id the server never reads. So ignore
        // chartId under Shiny and say so, rather than leaving it to a comment.
        if (meta.chartId) {
          if (HTMLWidgets.shinyMode) {
            console.warn(
              'gsm.vizr: ignoring metadata.chartId "' +
                meta.chartId +
                '" for Shiny output "' +
                el.id +
                '". Shiny outputs keep their outputId, which the proxy verbs ' +
                'and input$<id>_click/_select are keyed on.'
            );
          } else {
            el.id = meta.chartId;
          }
        }
        el.classList.add('gsm-vizr');
        // Container floor: dynamicSizing may set el.style.height, but it can
        // never collapse the widget below the configured minimum.
        el.style.minHeight = (input.minHeight || 0) + 'px';

        // Wrapper event contract: always dispatch gsm-viz-select (bubbling)
        // and mirror to Shiny inputs; user hooks (already revived) run after.
        // gsmMeta is stashed so a proxy update can re-compose the same glue.
        var spec = input.spec;
        el.gsmMeta = meta;
        composeEventCallbacks(el, spec, meta);

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
