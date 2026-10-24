// Wrapped in an IIFE: bars.js declares reviveHooks/composeEventCallbacks as
// page globals, and a page carrying both widgets must not let one binding's
// helpers replace the other's.
(function () {
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

  // Wrapper event contract: dispatch gsm-viz-select (bubbling), mirror to
  // Shiny inputs, then run any user hook with `this` set to the widget
  // element so it can reach el.gsmChart (e.g. to selectRow on rowclick).
  function composeEventCallbacks(el, spec, meta) {
    var user = spec.callbacks || {};
    function emit(detail, suffix) {
      el.dispatchEvent(
        new CustomEvent('gsm-viz-select', { bubbles: true, detail: detail })
      );
      if (window.Shiny && el.id) {
        Shiny.setInputValue(el.id + suffix, detail, { priority: 'event' });
      }
    }
    function chain(hook, args) {
      if (typeof hook === 'function') hook.apply(el, args);
    }
    spec.callbacks = Object.assign({}, user, {
      onClick: function (datum) {
        emit(
          { type: 'click', chartId: el.id, datum: datum, metadata: meta },
          '_click'
        );
        chain(user.onClick, arguments);
      },
      // Row header clicks deliberately do not select: consumers decide, via
      // el.gsmChart.helpers.selectRow.
      onRowClick: function (info) {
        emit(
          {
            type: 'rowclick',
            chartId: el.id,
            y: info.y,
            rows: info.rows,
            metadata: meta
          },
          '_rowclick'
        );
        chain(user.onRowClick, arguments);
      },
      onExpand: function (x, expanded) {
        emit(
          {
            type: 'expand',
            chartId: el.id,
            x: x,
            expanded: expanded,
            metadata: meta
          },
          '_expand'
        );
        chain(user.onExpand, arguments);
      }
    });
  }

  HTMLWidgets.widget({
    name: 'tiles',
    type: 'output',
    factory: function (el, width, height) {
      return {
        renderValue: function (input) {
          if (input.bDebug) console.log(input);
          var spec = input.spec || {};
          reviveHooks(spec, input.jsHooks);
          if (el.gsmChart) {
            el.gsmChart.destroy();
            delete el.gsmChart;
          }
          el.innerHTML = '';
          var meta = input.metadata || {};
          // Same rule as bars: under Shiny the outputId keys the
          // input$<id>_* names, so chartId must not rename the element there.
          if (meta.chartId) {
            if (HTMLWidgets.shinyMode) {
              console.warn(
                'gsm.vizr: ignoring metadata.chartId "' +
                  meta.chartId +
                  '" for Shiny output "' +
                  el.id +
                  '". Shiny outputs keep their outputId, which ' +
                  'input$<id>_click/_rowclick/_expand are keyed on.'
              );
            } else {
              el.id = meta.chartId;
            }
          }
          el.classList.add('gsm-vizr', 'gsm-vizr-tiles');

          // data and expand.data travel column-wise to keep the payload small.
          var data = HTMLWidgets.dataframeToD3(input.data) || [];
          if (input.expandData) {
            spec.expand = spec.expand || {};
            spec.expand.data = HTMLWidgets.dataframeToD3(input.expandData) || [];
          }

          el.gsmMeta = meta;
          composeEventCallbacks(el, spec, meta);
          el.gsmChart = gsmViz.default.tiles(el, data, spec);
        },
        resize: function (width, height) {}
      };
    }
  });
})();
