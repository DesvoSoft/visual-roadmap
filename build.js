#!/usr/bin/env node
/* build.js — Standalone Single-File HTML Generator
   Bundles all CSS and JS from viewer/ into a single, zero-dependency,
   portable HTML file: dist/roadmap.html.
   Users and AI agents can drop this single file into ANY project!
*/

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const VIEWER_DIR = path.join(ROOT, 'viewer');
const DIST_DIR = path.join(ROOT, 'dist');

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

console.log('⚡ Compilando Visual Roadmap Standalone Bundle...');

/* Read source files */
let html = fs.readFileSync(path.join(VIEWER_DIR, 'index.html'), 'utf8');
const tokensCss = fs.readFileSync(path.join(VIEWER_DIR, 'tokens.css'), 'utf8');
const viewerCss = fs.readFileSync(path.join(VIEWER_DIR, 'viewer.css'), 'utf8');

const mdJs = fs.readFileSync(path.join(VIEWER_DIR, 'md.js'), 'utf8');
const watcherJs = fs.readFileSync(path.join(VIEWER_DIR, 'watcher.js'), 'utf8');
const timelineJs = fs.readFileSync(path.join(VIEWER_DIR, 'timeline.js'), 'utf8');
const boardJs = fs.readFileSync(path.join(VIEWER_DIR, 'board.js'), 'utf8');
const logJs = fs.readFileSync(path.join(VIEWER_DIR, 'log.js'), 'utf8');
const appJs = fs.readFileSync(path.join(VIEWER_DIR, 'app.js'), 'utf8');

/* Inline CSS */
const combinedCss = `\n/* Inlined tokens.css */\n${tokensCss}\n\n/* Inlined viewer.css */\n${viewerCss}\n`;
html = html.replace(/<link rel="stylesheet" href="tokens\.css">/, '');
html = html.replace(/<link rel="stylesheet" href="viewer\.css">/, `<style>\n${combinedCss}\n</style>`);

/* Inline Scripts */
const combinedJs = `
  /* md.js */
  ${mdJs}

  /* watcher.js */
  ${watcherJs}

  /* timeline.js */
  ${timelineJs}

  /* board.js */
  ${boardJs}

  /* log.js */
  ${logJs}

  /* app.js */
  ${appJs}
`;

html = html.replace(/<script src="md\.js"><\/script>/, '');
html = html.replace(/<script src="watcher\.js"><\/script>/, '');
html = html.replace(/<script src="timeline\.js"><\/script>/, '');
html = html.replace(/<script src="board\.js"><\/script>/, '');
html = html.replace(/<script src="log\.js"><\/script>/, '');
html = html.replace(/<script src="app\.js"><\/script>/, `<script>\n${combinedJs}\n</script>`);

/* Write standalone HTML */
const destFile = path.join(DIST_DIR, 'roadmap.html');
fs.writeFileSync(destFile, html, 'utf8');

const sizeKb = (fs.statSync(destFile).size / 1024).toFixed(1);
console.log(`✅ Bundle standalone generado con éxito: ${destFile} (${sizeKb} KB)`);
console.log(`🚀 Este archivo único puede copiarse a cualquier proyecto sin servidores ni dependencias.`);
