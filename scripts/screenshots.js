#!/usr/bin/env node
/* scripts/screenshots.js — regenerate the README screenshots.
   Builds a demo roadmap with the agent commands, using times relative to
   now (so the viewer shows a live task), serves it and captures each view
   with a headless Chromium browser (Edge or Chrome).

   npm run screenshots            → assets/screenshots/*.png
   BROWSER=/path/to/chrome npm run screenshots */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn, spawnSync } = require('child_process');
const Agent = require('../lib/agent.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'screenshots');
const PORT = 3597;
const MIN = 60000;

function browser() {
  const candidates = [
    process.env.BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'
  ].filter(Boolean);
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) throw new Error('No Chromium browser found; set BROWSER=/path/to/chrome');
  return found;
}

/** A believable agent session: v0.1 shipped, v0.2 in progress, v0.3 planned. */
function demoRoadmap(now) {
  const t = minutesAgo => now - minutesAgo * MIN;
  let text = `---
title: Pixel Pantry
subtitle: Recipe app
owner: agent
started: ${Agent.stamp(t(260))}
updated: ${Agent.stamp(t(260))}
capacity: 1
version: "0.2"
---

## Contexto

Web app to plan meals from a shared pantry.

## Releases

## Estimaciones

## Últimos cambios
`;
  const run = (fn, ...args) => { const r = fn(text, ...args); text = r.text; return r; };
  const add = (name, effort, release, extra = {}, at = 260) => run(Agent.add, name, { effort, release, ...extra }, t(at));

  add('Recipe list renders from the API', '35m', 'v0.1 · Browse recipes');
  add('Search filters recipes by ingredient', '40m', 'v0.1 · Browse recipes', { after: 'T001' });
  add('Recipe detail page with steps', '30m', 'v0.1 · Browse recipes');
  add('Pantry items persist per user', '45m', 'v0.2 · Pantry & planner', { group: 'Pantry' });
  add('Weekly planner drag and drop', '3h', 'v0.2 · Pantry & planner', { group: 'Planner', after: 'T004' });
  add('Shopping list from missing ingredients', '40m', 'v0.2 · Pantry & planner', { group: 'Shopping list', after: 'T005' });
  add('Sign in with email link', '50m', 'v0.3 · Accounts');
  add('Share a pantry with family', '1h', 'v0.3 · Accounts', { after: 'T007' });
  add('Account settings page', '25m', 'v0.3 · Accounts', { after: 'T007' });

  const lines = (add, del) => () => ({ add, del });
  run(Agent.start, 'T001', {}, t(250));
  run(Agent.done, 'T001', { note: 'API contract test green', diffSince: lines(184, 12) }, t(214));
  run(Agent.start, 'T002', {}, t(212));
  run(Agent.eta, 'T002', '20m', 'Accent-insensitive matching', t(190));
  run(Agent.done, 'T002', { note: '6 search tests green', diffSince: lines(142, 30), next: true }, t(165));
  run(Agent.done, 'T003', { note: 'Checked on mobile width', diffSince: lines(96, 8), next: true }, t(140));
  run(Agent.done, 'T004', { note: 'Survives reload; 4 tests', diffSince: lines(221, 40) }, t(98));
  run(Agent.split, 'T005', ['Planner grid for the week:40m', 'Drag recipes into days:45m', 'Persist the plan:30m'], t(96));
  run(Agent.start, 'T010', {}, t(95));
  run(Agent.done, 'T010', { note: 'Grid snapshot test', diffSince: lines(133, 5), next: true }, t(58));
  run(Agent.eta, 'T011', '35m', 'Touch drag needs a polyfill', t(20));
  run(Agent.progress, 'T011', 60, t(10));
  run(Agent.note, 'Decision: plans are stored per household, not per user', { icon: '📄' }, t(8));
  return text;
}

async function waitFor(url) {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server did not start');
}

async function main() {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.js')], { stdio: 'ignore' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-roadmap-shots-'));
  const file = path.join(dir, 'ROADMAP.md');
  fs.writeFileSync(file, demoRoadmap(Date.now()));
  fs.mkdirSync(OUT, { recursive: true });
  const server = spawn(process.execPath, [path.join(ROOT, 'bin', 'visual-roadmap.js'), 'serve', '--file', file, '--port', String(PORT)], { stdio: 'ignore' });
  const exe = browser();
  try {
    await waitFor(`http://127.0.0.1:${PORT}/ping`);
    const shots = [
      ['tracking.png', 'view=timeline&theme=dark&lang=en', '1440,900'],
      ['versions.png', 'view=board&theme=dark&lang=en', '1440,900'],
      ['tracking-light.png', 'view=timeline&theme=light&lang=en', '1440,900']
    ];
    for (const [name, query, size] of shots) {
      const target = path.join(OUT, name);
      fs.rmSync(target, { force: true });
      /* Headless mode support differs between Edge/Chrome builds: try both. */
      for (const mode of ['--headless', '--headless=new']) {
        const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-profile-'));
        /* Piped stdio on purpose: some Edge builds exit early when stdio is ignored. */
        spawnSync(exe, [
          mode, '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--no-first-run', '--mute-audio',
          `--user-data-dir=${profile}`, `--window-size=${size}`, '--force-device-scale-factor=1',
          `--screenshot=${target}`,
          `http://127.0.0.1:${PORT}/?${query}`
        ], { encoding: 'utf8', timeout: 60000 });
        for (let i = 0; i < 40 && !fs.existsSync(target); i++) await new Promise(r => setTimeout(r, 250));
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
        if (fs.existsSync(target)) break;
      }
      if (!fs.existsSync(target)) throw new Error(`Browser did not write ${name}`);
      console.log(`✓ assets/screenshots/${name}`);
    }
  } finally {
    server.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
