const path = require('path');
const os = require('os');
const fs = require('fs');

const ENTRY_PATH = path.join(__dirname, 'client-entry.tsx');
const NODE_MODULES = path.join(__dirname, '..', 'node_modules');

let bundlePathPromise = null;

/**
 * Bundles tests/helpers/client-entry.tsx (which mounts the real react/src/ModelCard
 * component against window.__DATA__) into a browser IIFE, once per worker process,
 * and writes it to a temp file so it can be injected via addScriptTag.
 */
function buildReactBundle() {
  if (!bundlePathPromise) {
    bundlePathPromise = (async () => {
      const esbuild = require('esbuild');
      const outfile = path.join(os.tmpdir(), `model-card-react-test-${process.pid}.js`);
      await esbuild.build({
        entryPoints: [ENTRY_PATH],
        bundle: true,
        platform: 'browser',
        format: 'iife',
        jsx: 'automatic',
        outfile,
        alias: {
          react: path.join(NODE_MODULES, 'react'),
          'react-dom': path.join(NODE_MODULES, 'react-dom'),
        },
      });
      return outfile;
    })();
  }
  return bundlePathPromise;
}

/**
 * Loads a fixture through the real React ModelCard component into `page`, genuinely
 * mounted via ReactDOM.createRoot (not renderToStaticMarkup, which emits no event
 * listeners at all -- a page built from it would pass a "no crash" check while every
 * click handler is silently dead).
 */
async function loadReactPage(page, data) {
  const bundlePath = await buildReactBundle();
  await page.setContent('<!doctype html><html><body style="margin:0;"><div id="root"></div></body></html>');
  await page.evaluate((fixtureData) => {
    // @ts-ignore
    window.__DATA__ = fixtureData;
  }, data);
  await page.addScriptTag({ path: bundlePath });
}

module.exports = { loadReactPage, buildReactBundle };
