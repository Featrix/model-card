// Bundled by esbuild (see react-page.js) into a browser IIFE that mounts
// ModelCard against window.__DATA__. Not part of the published react/ package --
// test-only entry point so tests exercise a genuinely mounted React app (with
// real event listeners), not React's static-markup renderer, which has none.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ModelCard } from '../../react/src/ModelCard';

declare const window: any;

const root = createRoot(document.getElementById('root')!);
root.render(React.createElement(ModelCard, { data: window.__DATA__ }));
