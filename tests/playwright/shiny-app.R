# Fixture app for the Shiny Playwright spec. Run from the package root:
#   Rscript tests/playwright/shiny-app.R   (or via npm run test:shiny)
devtools::load_all(".", quiet = TRUE)
library(shiny)

dfA <- data.frame(site = c("S1", "S1", "S2"), flag = c("2", "1", "2"))
dfB <- data.frame(
  site = c("S3", "S3", "S3", "S4"),
  flag = c("1", "1", "0", "2")
)
dfF <- data.frame(
  site = rep(c("S1", "S2"), times = 4),
  flag = rep(c("1", "2"), each = 4),
  country = rep(c("USA", "CAN"), each = 2, times = 2)
)

ui <- fluidPage(
  tags$script(HTML(
    "document.addEventListener('gsm-viz-select', function (e) {
       (window.__gsmEvents = window.__gsmEvents || []).push(e.detail);
     });"
  )),
  barsOutput("chart"),
  verbatimTextOutput("sel"),
  actionButton("btnSelect", "proxy select S1"),
  actionButton("btnLoud", "loud select S2"),
  actionButton("btnClear", "proxy clear"),
  actionButton("btnSwap", "swap data"),
  actionButton("btnHook", "proxy a js_hook tooltip"),
  actionButton("btnSpecSwap", "updateData with a full spec"),
  actionButton("btnSpecHook", "updateSpec with an onClick hook"),
  barsOutput("switchChart"),
  actionButton("btnType", "toggle bars/facet"),
  barsOutput("facetChart"),
  actionButton("btnFacet", "proxy a facet (must fail loudly)"),
  actionButton("btnBoth", "facet verb + valid verb in one flush"),
  # Unlike a static rmarkdown tabset, a hidden Shiny tabPanel measures 0x0 at
  # render time, because Shiny sizes widgets from the live DOM. This is the
  # case the binding's resizeOnReveal hook exists for.
  tabsetPanel(
    tabPanel("visibleTab", "text so the second tab starts hidden"),
    tabPanel("hiddenTab", barsOutput("tabChart"))
  )
)

server <- function(input, output, session) {
  output$chart <- renderBars(
    bars(
      dfA,
      bars_spec(
        x = "site",
        fill = "flag",
        selection = list(enabled = TRUE)
      )
    )
  )
  output$facetChart <- renderBars(
    facet_bars(dfF, bars_spec(x = "site", fill = "flag"), facet_spec("country"))
  )
  # Carries a chartId deliberately: under Shiny the binding must KEEP the
  # outputId and warn, because the proxy verbs and input$<id>_click/_select are
  # keyed on it. Renaming the element breaks both without any error.
  output$tabChart <- renderBars(
    bars(dfA, bars_spec(x = "site", fill = "flag"),
      metadata = list(chartId = "should-be-ignored-under-shiny")
    )
  )
  # One reactive output that swaps renderer type: the case where a stale
  # renderer left behind by the previous render would survive.
  output$switchChart <- renderBars({
    if (input$btnType %% 2 == 1) {
      facet_bars(dfF, bars_spec(x = "site", fill = "flag"), facet_spec("country"))
    } else {
      bars(dfA, bars_spec(x = "site", fill = "flag"))
    }
  })
  output$sel <- renderPrint(input$chart_select)
  observeEvent(
    input$btnSelect,
    proxy_select_category(bars_proxy("chart"), "S1")
  )
  observeEvent(
    input$btnLoud,
    proxy_select_category(bars_proxy("chart"), "S2", silent = FALSE)
  )
  observeEvent(input$btnClear, proxy_clear_selection(bars_proxy("chart")))
  observeEvent(input$btnSwap, proxy_update_data(bars_proxy("chart"), dfB))
  observeEvent(
    input$btnHook,
    proxy_update_spec(
      bars_proxy("chart"),
      list(
        tooltip = list(
          formatter = js_hook(
            "function (value) { return 'proxied: ' + value; }"
          )
        )
      )
    )
  )
  observeEvent(input$btnSpecSwap, {
    proxy_update_data(
      bars_proxy("chart"),
      dfB,
      spec = bars_spec(x = "site", fill = "flag", selection = list(enabled = TRUE))
    )
  })
  observeEvent(input$btnSpecHook, {
    proxy_update_spec(
      bars_proxy("chart"),
      list(callbacks = list(
        onClick = js_hook("function (pt) { window.__hookRan = true; }")
      ))
    )
  })
  observeEvent(input$btnFacet, proxy_clear_selection(bars_proxy("facetChart")))
  # Both messages leave in one reactive flush, so the browser receives them in
  # a single batch. The facet verb throws inside the message handler; this is
  # what shows whether that throw takes the sibling message down with it.
  observeEvent(input$btnBoth, {
    proxy_clear_selection(bars_proxy("facetChart"))
    proxy_select_category(bars_proxy("chart"), "S1")
  })
}

runApp(shinyApp(ui, server), port = 8123, launch.browser = FALSE)
