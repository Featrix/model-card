// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  timeout: 15_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    headless: true,
  },
});
