#!/usr/bin/env node
/* scripts/simulate.js — watch a scripted agent session in the live viewer.

   npm run demo                      # opens the viewer, one step every 4 s
   node scripts/simulate.js --step 2 --port 3590 --keep --no-open
   node scripts/simulate.js --fast --no-server   # no delays, no viewer (used by the tests)

   Creates a throwaway project in the OS temp folder and drives it only through the
   public CLI, exactly as an agent would. Nothing in this repository is modified. */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'bin', 'visual-roadmap.js');

const argv = process.argv.slice(2);
const flag = name => argv.includes(`--${name}`);
const value = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback; };

const fast = flag('fast');
const withServer = !flag('no-server');
const keep = flag('keep');
const openBrowser = !fast && !flag('no-open');
const port = Number(value('port', '3590'));
const stepMs = fast ? 0 : Number(value('step', '4')) * 1000;

/* The session an agent would run: plan with releases and subgroups, then work task by task. */
const SCRIPT = [
  ['Plan', 'add', 'La API valida email y contraseña', '--effort', '30m', '--release', 'v0.1 · Acceso', '--group', 'Backend'],
  ['Plan', 'add', 'Las sesiones expiran a las 24 h', '--effort', '25m', '--group', 'Backend'],
  ['Plan', 'add', 'El formulario muestra errores en línea', '--effort', '40m', '--release', 'v0.1 · Acceso', '--group', 'Interfaz'],
  ['Plan', 'add', 'El botón de salir cierra la sesión', '--effort', '15m', '--release', 'v0.1 · Acceso', '--group', 'Interfaz'],
  ['Plan', 'add', 'El usuario edita su nombre y avatar', '--effort', '45m', '--release', 'v0.2 · Perfil', '--group', 'Datos'],
  ['Plan', 'add', 'Las preferencias se guardan al instante', '--effort', '30m', '--release', 'v0.2 · Perfil', '--group', 'Datos'],
  ['Work', 'start', 'T001'],
  ['Work', 'progress', 'T001', '50'],
  ['Work', 'done', 'T001', '--note', '8 pruebas de validación en verde', '--next'],
  ['Work', 'eta', 'T002', '20m', 'Falta cubrir el refresco del token'],
  ['Work', 'progress', 'T002', '70'],
  ['Work', 'done', 'T002', '--note', 'Expiración probada con reloj simulado', '--next'],
  ['Work', 'block', 'T003', 'Falta la guía de estilos de errores'],
  ['Work', 'log', 'Decisión: los errores se muestran bajo cada campo'],
  ['Work', 'start', 'T004'],
  ['Work', 'done', 'T004', '--note', 'Logout probado en Chrome y Firefox'],
  ['Work', 'start', 'T003'],
  ['Work', 'progress', 'T003', '60'],
  ['Work', 'done', 'T003', '--note', 'Capturas de los 4 estados de error', '--next'],
  ['Work', 'split', 'T005', 'Editar nombre:20m', 'Subir avatar:35m'],
  ['Work', 'progress', 'T007', '40'],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function run(dir, args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  const out = (r.stdout + r.stderr).trim();
  if (r.status !== 0) throw new Error(`visual-roadmap ${args.join(' ')} failed:\n${out}`);
  return out;
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-roadmap-demo-'));
  const file = path.join(dir, 'ROADMAP.md');
  const stamp = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace('T', ' ');
  fs.writeFileSync(file, fs.readFileSync(path.join(ROOT, 'templates', 'ROADMAP.seed.md'), 'utf8')
    .replace(/\[PROJECT_NAME\]/g, 'Demo App').replace(/\[OWNER\]/g, 'agent').replace(/\[NOW\]/g, stamp));

  let server = null;
  if (withServer) {
    server = spawn(process.execPath, [CLI, openBrowser ? 'live' : 'serve', '--file', file, '--port', String(port)], { stdio: 'ignore' });
    console.log(`Viewer: http://127.0.0.1:${port}/`);
    if (!fast) await sleep(Math.max(stepMs, 2500));   /* let the browser open before the first change */
  }
  console.log(`Roadmap: ${file}\n`);

  try {
    for (const [phase, ...args] of SCRIPT) {
      const out = run(dir, args);
      console.log(`${phase.padEnd(4)}  $ visual-roadmap ${args.map(a => /\s/.test(a) ? `"${a}"` : a).join(' ')}\n      ${out.split('\n')[0]}`);
      await sleep(stepMs);
    }
    const check = JSON.parse(run(dir, ['check', '--json']));
    const errors = (check.issues || check).filter?.(i => i.level === 'error') || [];
    console.log(`\n${run(dir, ['status'])}`);
    if (errors.length) { console.error('Roadmap errors:', errors); process.exitCode = 1; }
    if (withServer && !fast) {
      console.log(`\nDone. The viewer stays open: Ctrl+C to stop.`);
      await new Promise(resolve => process.once('SIGINT', resolve));
    }
  } finally {
    server?.kill();
    if (!keep) fs.rmSync(dir, { recursive: true, force: true });
    else console.log(`Kept: ${dir}`);
  }
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
