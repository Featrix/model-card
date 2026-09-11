const path = require('path');

const JS_PATH = path.join(__dirname, '..', '..', 'javascript', 'model-card.js');

/**
 * Loads a fixture through the canonical JS renderer into `page`: injects
 * model-card.js via addScriptTag (NOT an inline <script> -- the file's own
 * header doc comment contains a literal "</script>" example that would
 * terminate an inlined block early and corrupt the rest of the script),
 * renders the fixture, and wires up attachEventListeners so click handlers
 * actually work -- the same two-step process html_renderer.py's CDN-loaded
 * output does.
 */
async function loadJsPage(page, data) {
  await page.setContent('<!doctype html><html><body style="margin:0;"><div id="root"></div></body></html>');
  await page.addScriptTag({ path: JS_PATH });
  await page.evaluate((fixtureData) => {
    // @ts-ignore -- FeatrixModelCard is a global set by model-card.js
    const html = window.FeatrixModelCard.renderHTML(fixtureData, {});
    const root = document.getElementById('root');
    root.innerHTML = html;
    // @ts-ignore
    window.FeatrixModelCard.attachEventListeners(root);
  }, data);
}

module.exports = { loadJsPage, JS_PATH };
