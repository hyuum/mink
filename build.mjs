// Build script. Produces two outputs:
//   dist/      the installable web app (PWA): React bundled in, works offline.
//   preview/   a single-file preview for hosted sandboxes that only allow
//              React from a CDN; React is read from window.React instead.
// Usage: node build.mjs            build both
//        node build.mjs --serve    build dist/ and serve it on http://localhost:5173
import * as esbuild from 'esbuild';
import { mkdir, readFile, writeFile, copyFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const serve = process.argv.includes('--serve');
const css = await readFile('src/styles/app.css', 'utf8');
const FONT_LINK =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Young+Serif&display=swap">';

const common = {
  entryPoints: ['src/main.tsx'],
  bundle: true,
  minify: !serve,
  format: 'iife',
  target: ['es2020', 'safari15'],
  jsx: 'automatic',
  legalComments: 'none',
  logLevel: 'info',
  define: { __PREVIEW__: 'false' },
};

// Maps react imports to the globals the CDN builds define (window.React, window.ReactDOM).
const reactGlobals = {
  name: 'react-globals',
  setup(build) {
    const shims = {
      react: 'const R = window.React; export default R; export const { useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore, useId, Fragment, createElement } = R;',
      'react/jsx-runtime': 'const R = window.React; export const Fragment = R.Fragment; export function jsx(t, p, k) { return R.createElement(t, k === undefined ? p : Object.assign({}, p, { key: k })); } export const jsxs = jsx;',
      'react-dom/client': 'export const createRoot = (el) => window.ReactDOM.createRoot(el);',
    };
    build.onResolve({ filter: /^(react|react\/jsx-runtime|react-dom\/client)$/ }, (a) => ({ path: a.path, namespace: 'react-globals' }));
    build.onLoad({ filter: /.*/, namespace: 'react-globals' }, (a) => ({ contents: shims[a.path], loader: 'js' }));
  },
};

async function copyPublic(out) {
  for (const f of await readdir('public')) await copyFile(join('public', f), join(out, f));
}

function appHtml() {
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#4B6545">
<title>Matcha Planner</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon.svg">
${FONT_LINK}
<link rel="stylesheet" href="app.css">
</head>
<body>
<div id="root"></div>
<script src="app.js"></script>
</body>
</html>
`;
}

if (serve) {
  await mkdir('dist', { recursive: true });
  await writeFile('dist/index.html', appHtml());
  await writeFile('dist/app.css', css);
  await copyPublic('dist');
  const ctx = await esbuild.context({ ...common, outfile: 'dist/app.js', sourcemap: true });
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: 'dist', port: 5173 });
  console.log(`Serving on http://localhost:${port}`);
} else {
  await rm('dist', { recursive: true, force: true });
  await rm('preview', { recursive: true, force: true });
  await mkdir('dist', { recursive: true });
  await mkdir('preview', { recursive: true });

  // 1. Installable app
  await esbuild.build({ ...common, outfile: 'dist/app.js' });
  await writeFile('dist/index.html', appHtml());
  await writeFile('dist/app.css', css);
  await copyPublic('dist');

  // 2. Single-file preview (React 18 from cdnjs, app code inline)
  const result = await esbuild.build({ ...common, write: false, plugins: [reactGlobals], define: { __PREVIEW__: 'true' } });
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const preview = `<title>Matcha Planner</title>
${FONT_LINK}
<style>
${css}
</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>
${js}
</script>
`;
  await writeFile('preview/index.html', preview);
  console.log('Built dist/ and preview/index.html');
}
