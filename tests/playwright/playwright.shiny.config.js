const { defineConfig } = require('@playwright/test');
// R_LIBS must be exported in the invoking shell; the command inherits it.
module.exports = defineConfig({
  testDir: '.',
  testMatch: 'shiny.spec.js',
  use: { headless: true },
  webServer: {
    command: 'cd ../.. && Rscript tests/playwright/shiny-app.R',
    url: 'http://127.0.0.1:8123',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
