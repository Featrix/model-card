// @ts-check
const { test, expect } = require('@playwright/test');
const { listFixtures, loadFixture } = require('./helpers/fixtures');
const { loadJsPage } = require('./helpers/js-page');

for (const fixtureName of listFixtures()) {
  test(`JS: ${fixtureName} renders with no page errors`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await loadJsPage(page, loadFixture(fixtureName));

    expect(errors, `page errors: ${errors.join('; ')}`).toEqual([]);
    await expect(page.locator('.header h1')).toBeVisible();
  });
}

test.describe('multiclass fixture (ticket_priority_multiclass.json)', () => {
  test('confusion matrix, per-class metrics, and class population bars all render', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await loadJsPage(page, loadFixture('ticket_priority_multiclass.json'));

    expect(errors).toEqual([]);
    // Regression coverage for the per_class_precision/recall/f1 schema drift
    // (confusion_matrix.per_class_* dicts, not classification_metrics.per_class) --
    // this table silently rendered empty when the fixture didn't match. Only one
    // epoch tab is visible at a time (the other 3 are `display:none` until
    // clicked), so these need :visible -- .first() in raw DOM order would just
    // as happily match content sitting in a currently-hidden tab.
    await expect(page.locator('.confusion-title:visible', { hasText: 'Per-Class Metrics' })).toHaveCount(1);
    await expect(page.locator('.confusion-wrapper:visible')).toHaveCount(1);
    // Dict-shaped class_distribution with >2 classes renders population bars,
    // not the old one-column-per-class table.
    await expect(page.locator('.cls-dist-row')).toHaveCount(4);
    // Dynamic epoch tabs: best_roc_auc, best_accuracy, best_macro_f1, best_cross_entropy.
    await expect(page.locator('.epoch-tab:not(.sp-strategy-tab)')).toHaveCount(4);
    // Data-driven selective-prediction strategy tabs: everything, balanced, detect_class_P0-3.
    await expect(page.locator('.sp-strategy-tab')).toHaveCount(6);
  });

  test('Model Type combines predictor kind and task type for a realistic model_type string', async ({ page }) => {
    await loadJsPage(page, loadFixture('ticket_priority_multiclass.json'));
    // Scoped to the actual hero-card element, not getByText -- the page also
    // contains a hidden Raw JSON dump of the whole fixture, which getByText
    // matches just as happily since it's a real (if display:none) text node.
    await expect(page.locator('.metric-value', { hasText: 'Neural Predictor' })).toBeVisible();
    await expect(page.locator('.metric-value', { hasText: 'Multiclass Classifier' })).toBeVisible();
  });

  test('clicking a Model Details epoch tab switches the active tab with no crash', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await loadJsPage(page, loadFixture('ticket_priority_multiclass.json'));

    const tab = page.locator('.epoch-tab:not(.sp-strategy-tab)', { hasText: 'Best Accuracy' });
    await tab.click();

    await expect(tab).toHaveClass(/active/);
    expect(errors).toEqual([]);
  });

  test('clicking a Selective Prediction strategy tab switches the active tab with no crash', async ({ page }) => {
    // Regression test: strategy-tab buttons share the .epoch-tab CSS class with Model
    // Details tabs for styling, so the generic epoch-tab click handler used to also
    // bind to them, read their (nonexistent) data-tab attribute, and throw on
    // null.classList -- invisible until something actually click-tested this path.
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await loadJsPage(page, loadFixture('ticket_priority_multiclass.json'));

    const tab = page.locator('.sp-strategy-tab', { hasText: 'Detect P1' });
    await tab.click();

    await expect(tab).toHaveClass(/active/);
    expect(errors).toEqual([]);
    await expect(page.getByText('Covered Recall (P1)')).toBeVisible();
  });
});

test.describe('binary fixture (pred_test_441pm.json) regression', () => {
  test('Training Dataset shows real class counts, not zeros', async ({ page }) => {
    // Regression test: the class-distribution table used to hardcode
    // train_distribution['1']/['0'] lookups regardless of the card's actual
    // minority_class/majority_class labels, silently showing 0/0 for any binary
    // card whose classes weren't literally named "0"/"1" (i.e. almost all real data,
    // including this fixture's "bad"/"good" labels).
    await loadJsPage(page, loadFixture('pred_test_441pm.json'));
    const trainRow = page.locator('tr', { hasText: 'Train' }).first();
    await expect(trainRow).toContainText('192');
    await expect(trainRow).toContainText('447');
  });

  test('binary confusion matrix and Model Details epoch tab still work', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await loadJsPage(page, loadFixture('pred_test_441pm.json'));

    await expect(page.locator('.confusion-wrapper:visible')).toHaveCount(1);
    const epochTab = page.locator('.epoch-tab:not(.sp-strategy-tab)', { hasText: 'Best PR-AUC' });
    await expect(epochTab).toHaveCount(1);
    await epochTab.click();
    await expect(epochTab).toHaveClass(/active/);
    expect(errors).toEqual([]);
  });
});
