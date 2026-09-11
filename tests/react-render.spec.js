// @ts-check
const { test, expect } = require('@playwright/test');
const { listFixtures, loadFixture } = require('./helpers/fixtures');
const { loadReactPage } = require('./helpers/react-page');

// React's client-entry bundle takes a moment to mount on first use per worker
// (esbuild runs once, cached after); give the initial render a beat.
test.slow();

for (const fixtureName of listFixtures()) {
  test(`React: ${fixtureName} renders with no page errors`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await loadReactPage(page, loadFixture(fixtureName));
    await expect(page.locator('.header h1')).toBeVisible();

    expect(errors, `page errors: ${errors.join('; ')}`).toEqual([]);
  });
}

test.describe('multiclass fixture (ticket_priority_multiclass.json)', () => {
  test('confusion matrix, per-class metrics, and class population bars all render', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await loadReactPage(page, loadFixture('ticket_priority_multiclass.json'));
    await expect(page.locator('.header h1')).toBeVisible();

    expect(errors).toEqual([]);
    // Only one epoch tab's content is visible at a time (the rest are
    // display:none until clicked), so these need :visible -- .first() in raw
    // DOM order would just as happily match content sitting in a hidden tab.
    await expect(page.locator('.confusion-title:visible', { hasText: 'Per-Class Metrics' })).toHaveCount(1);
    await expect(page.locator('.confusion-wrapper:visible')).toHaveCount(1);
    // Regression coverage: the dict-shaped class_distribution population-bar view
    // (added to JS in v1.17.6) was never ported to React -- dict-shaped >2-class
    // distributions fell through to the legacy 2-column binary table and silently
    // dropped every class past the two picked as minority/majority.
    await expect(page.locator('.cls-dist-row')).toHaveCount(4);
    // React doesn't need JS's .sp-strategy-tab class (it binds onClick per-element,
    // with no risk of the class-collision bug that class exists in JS to avoid) --
    // Model Details tabs and Selective Prediction tabs are told apart here by
    // which <details> section they're rendered in instead.
    await expect(modelDetailsTabs(page)).toHaveCount(4);
    await expect(selectivePredictionTabs(page)).toHaveCount(6);
  });

  test('clicking a Model Details epoch tab switches the active tab with no crash', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await loadReactPage(page, loadFixture('ticket_priority_multiclass.json'));

    const tab = modelDetailsTabs(page).filter({ hasText: 'Best Accuracy' });
    await tab.click();

    await expect(tab).toHaveClass(/active/);
    expect(errors).toEqual([]);
  });

  test('clicking a Selective Prediction strategy tab switches the active tab with no crash', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await loadReactPage(page, loadFixture('ticket_priority_multiclass.json'));

    const tab = selectivePredictionTabs(page).filter({ hasText: 'Detect P1' });
    await tab.click();

    await expect(tab).toHaveClass(/active/);
    expect(errors).toEqual([]);
    await expect(page.getByText('Covered Recall (P1)')).toBeVisible();
  });
});

function modelDetailsTabs(page) {
  return page.locator('details:has-text("MODEL DETAILS") .epoch-tabs button');
}

function selectivePredictionTabs(page) {
  return page.locator('details:has-text("SELECTIVE PREDICTION") .epoch-tabs button');
}

test.describe('binary fixture (pred_test_441pm.json) regression', () => {
  test('Training Dataset shows real class counts, not zeros', async ({ page }) => {
    // Regression test: TRAINING DATASET used to hardcode
    // train_distribution['1']/['0'] lookups regardless of the card's actual
    // minority_class/majority_class labels, always showing 0/0 for a binary
    // card whose classes weren't literally named "0"/"1" -- this fixture's
    // "bad"/"good" labels included.
    await loadReactPage(page, loadFixture('pred_test_441pm.json'));
    const trainRow = page.locator('tr', { hasText: 'Train' }).first();
    await expect(trainRow).toContainText('192');
    await expect(trainRow).toContainText('447');
  });
});
