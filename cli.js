#!/usr/bin/env node
/* cli.js — visual-roadmap CLI
   npx visual-roadmap init      → bootstraps ROADMAP.md + viewer/ in current dir
   npx visual-roadmap serve     → SSE server for live updates
   npx visual-roadmap skill     → prints SKILL.md path (for AI agent reference)
   npx visual-roadmap open      → opens the viewer in the default browser
   visual-roadmap --version
   visual-roadmap --help
*/

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const PKG     = require('./package.json');
const CWD     = process.cwd();
const SELF    = path.dirname(__filename);

const ARGS    = process.argv.slice(2);
const CMD     = ARGS[0] || 'help';
const FLAGS   = parseFlags(ARGS.slice(1));

/* ── utils ───────────────────────────────────────────── */

function parseFlags(args) {
  const f = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const k = args[i].slice(2);
      const v = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      f[k] = v;
    }
  }
  return f;
}

function log(msg)   { process.stdout.write(msg + '\n'); }
function info(msg)  { log(`\x1b[36mℹ\x1b[0m  ${msg}`); }
function ok(msg)    { log(`\x1b[32m✓\x1b[0m  ${msg}`); }
function warn(msg)  { log(`\x1b[33m⚠\x1b[0m  ${msg}`); }
function err(msg)   { log(`\x1b[31m✗\x1b[0m  ${msg}`); }
function bold(msg)  { return `\x1b[1m${msg}\x1b[0m`; }
function dim(msg)   { return `\x1b[2m${msg}\x1b[0m`; }
function gold(msg)  { return `\x1b[33m${msg}\x1b[0m`; }

/* ── copy viewer files ───────────────────────────────── */

const VIEWER_FILES = [
  'index.html',
  'tokens.css',
  'viewer.css',
  'md.js',
  'ui.js',
  'forecast.js',
  'watcher.js',
  'board.js',
  'timeline.js',
  'log.js',
  'app.js'
];

function copyViewer(destDir) {
  const src = path.join(SELF, 'viewer');
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  let copied = 0;
  for (const f of VIEWER_FILES) {
    const from = path.join(src, f);
    const to   = path.join(destDir, f);
    if (!fs.existsSync(from)) { warn(`viewer/${f} not found, skipping`); continue; }
    if (fs.existsSync(to) && !FLAGS.force) {
      warn(`${path.relative(CWD, to)} already exists — use --force to overwrite`);
      continue;
    }
    fs.copyFileSync(from, to);
    ok(`Copied → ${path.relative(CWD, to)}`);
    copied++;
  }
  return copied;
}

/* ── commands ─────────────────────────────────────────── */

function cmdInit() {
  const projectName = FLAGS.project || path.basename(CWD);
  const owner       = FLAGS.owner   || 'you';
  const localNow    = new Date();
  const now         = new Date(localNow.getTime() - localNow.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16).replace('T', ' ');
  const viewerDir   = path.join(CWD, FLAGS['viewer-dir'] || 'visual-roadmap');
  const roadmapFile = path.join(CWD, FLAGS.file || 'ROADMAP.md');

  log('');
  log(gold('  ╔═══════════════════════════════╗'));
  log(gold('  ║   Visual Roadmap — init       ║'));
  log(gold('  ╚═══════════════════════════════╝'));
  log('');

  /* 1. Create ROADMAP.md */
  if (fs.existsSync(roadmapFile) && !FLAGS.force) {
    warn(`${path.relative(CWD, roadmapFile)} already exists — use --force to overwrite`);
  } else {
    const seed = fs.readFileSync(path.join(SELF, 'ROADMAP.seed.md'), 'utf8')
      .replace(/\[PROJECT_NAME\]/g, projectName)
      .replace(/\[OWNER\]/g, owner)
      .replace(/\[NOW\]/g, now);
    fs.writeFileSync(roadmapFile, seed);
    ok(`Created  → ${path.relative(CWD, roadmapFile)}`);
  }

  /* 2. Copy standalone single-file viewer (zero dependencies) */
  const standaloneSrc = path.join(SELF, 'dist', 'roadmap.html');
  const standaloneDest = path.join(CWD, 'roadmap.html');
  if (fs.existsSync(standaloneSrc) && (!fs.existsSync(standaloneDest) || FLAGS.force)) {
    fs.copyFileSync(standaloneSrc, standaloneDest);
    ok(`Created  → ${path.relative(CWD, standaloneDest)} (Standalone viewer local)`);
  }

  /* 3. Copy modular viewer if flag --modular is provided */
  if (FLAGS.modular) {
    copyViewer(viewerDir);
    info(`Modular viewer copied to: ${path.relative(CWD, viewerDir)}/`);
  }

  /* 4. Copy SKILL.md next to ROADMAP.md */
  const skillSrc  = path.join(SELF, 'SKILL.md');
  const skillDest = path.join(CWD, 'SKILL.md');
  if (fs.existsSync(skillSrc) && !fs.existsSync(skillDest)) {
    fs.copyFileSync(skillSrc, skillDest);
    ok(`Copied  → ${path.relative(CWD, skillDest)}`);
  }

  log('');
  log(bold('  ¡Listo para usar!'));
  log(`  Ejecuta ${bold('visual-roadmap live')} para ver ${bold(path.relative(CWD, roadmapFile))} en vivo.`);
  log('  El agente actualiza tareas y estimaciones cuando cambian, sin escrituras periódicas.');
  log('');
}

function cmdServe() {
  const port = parseInt(FLAGS.port || FLAGS.p || '3579', 10);
  const file = path.resolve(CWD, FLAGS.file || FLAGS.f || 'ROADMAP.md');

  if (!fs.existsSync(file)) {
    err(`File not found: ${file}`);
    err(`Run  visual-roadmap init  first, or pass  --file path/to/ROADMAP.md`);
    process.exit(1);
  }

  /* Delegate to server.js */
  require('./server.js').serve({ file, port });
}

function cmdSkill() {
  // Skill discovery remains available for agents using the portable viewer.
  const p = path.join(SELF, 'SKILL.md');
  log(p);
  log('');
  info('Paste this path into your agent system prompt to activate the skill:');
  log(dim(`  Read ${p} and follow its instructions.`));
  log('');
  info('Or reference it remotely:');
  log(dim(`  Read https://raw.githubusercontent.com/DesvoSoft/visual-roadmap/main/SKILL.md`));
  log('');
}

function cmdLive() {
  const port = parseInt(FLAGS.port || '3579', 10);
  const file = path.resolve(CWD, FLAGS.file || 'ROADMAP.md');
  if (!fs.existsSync(file)) {
    err(`File not found: ${file}`);
    process.exitCode = 1;
    return;
  }
  const server = require('./server.js').serve({ file, port });
  server.once('listening', () => openUrl(`http://127.0.0.1:${port}/`));
}

function cmdOpen() {
  const viewerDir = FLAGS['viewer-dir'] || 'visual-roadmap';
  const modular = path.join(CWD, viewerDir, 'index.html');
  const portable = path.join(CWD, 'roadmap.html');
  const htmlPath = fs.existsSync(modular) ? modular : fs.existsSync(portable) ? portable : path.join(SELF, 'dist', 'roadmap.html');
  openUrl('file://' + htmlPath.replace(/\\/g, '/'));
}

function openUrl(url) {
  try {
    if (process.platform === 'win32') execSync(`cmd.exe /d /c start "" "${url}"`, { stdio: 'ignore' });
    else execSync(`${process.platform === 'darwin' ? 'open' : 'xdg-open'} "${url}"`, { stdio: 'ignore' });
    ok(`Opening: ${url}`);
  } catch {
    info(`Open manually: ${url}`);
  }
}

function cmdVersion() {
  log(`visual-roadmap v${PKG.version}`);
}

function cmdHelp() {
  log('');
  log(gold(bold('  visual-roadmap')) + dim(` v${PKG.version}`));
  log('  Live roadmap viewer for autonomous AI sessions');
  log('');
  log(bold('  Commands:'));
  log('');
  log('  ' + bold('init') + '           Bootstrap ROADMAP.md + viewer in the current directory');
  log('  ' + bold('serve') + '          Start SSE server for live updates without File System API');
  log('  ' + bold('live') + '           Start server and open the live viewer');
  log('  ' + bold('open') + '           Open the viewer in the default browser');
  log('  ' + bold('skill') + '          Print the SKILL.md path for AI agent configuration');
  log('');
  log(bold('  Flags:'));
  log('');
  log('  ' + bold('init') + ':');
  log('    --project "Name"         Project name  (default: current dir name)');
  log('    --owner   "username"     Owner handle  (default: "you")');
  log('    --file    ROADMAP.md     ROADMAP path  (default: ./ROADMAP.md)');
  log('    --viewer-dir visual-roadmap  Viewer dir  (default: ./visual-roadmap)');
  log('    --force                  Overwrite existing files');
  log('');
  log('  ' + bold('serve') + ':');
  log('    --file  ROADMAP.md       File to watch  (default: ./ROADMAP.md)');
  log('    --port  3579             SSE port       (default: 3579)');
  log('');
  log(bold('  Examples:'));
  log('');
  log('    visual-roadmap init --project "My App"');
  log('    visual-roadmap live');
  log('    visual-roadmap serve --file ROADMAP.md --port 3579');
  log('    visual-roadmap open');
  log('');
  log(dim('  Skill:         https://raw.githubusercontent.com/DesvoSoft/visual-roadmap/main/SKILL.md'));
  log('');
}

/* ── router ───────────────────────────────────────────── */

const CMDS = {
  init:    cmdInit,
  serve:   cmdServe,
  live:    cmdLive,
  server:  cmdServe,
  skill:   cmdSkill,
  open:    cmdOpen,
  version: cmdVersion,
  '--version': cmdVersion,
  '-v':    cmdVersion,
  help:    cmdHelp,
  '--help': cmdHelp,
  '-h':    cmdHelp
};

const fn = CMDS[CMD];
if (fn) {
  fn();
} else {
  err(`Unknown command: ${CMD}`);
  cmdHelp();
  process.exit(1);
}
