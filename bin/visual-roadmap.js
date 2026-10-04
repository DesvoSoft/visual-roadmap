#!/usr/bin/env node
/* bin/visual-roadmap.js — visual-roadmap CLI
   Viewer:  init · live · serve · open · skill · agents
   Agent:   status · check · start · done · block · progress · eta · log · shot · shots
   Agent commands edit ROADMAP.md deterministically (see lib/agent.js). */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const PKG     = require('../package.json');
const CWD     = process.cwd();
const SELF    = path.join(__dirname, '..');   /* package root */

const ARGS    = process.argv.slice(2);
const CMD     = ARGS[0] || 'help';
const POS     = [];
const BOOLEAN_FLAGS = new Set(['force', 'modular', 'json', 'strict', 'no-agents', 'install', 'hooks', 'no-hooks', 'brief', 'final']);
const FLAGS   = parseFlags(ARGS.slice(1));

/* ── utils ───────────────────────────────────────────── */

function parseFlags(args) {
  const f = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const k = args[i].slice(2);
      const v = !BOOLEAN_FLAGS.has(k) && args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      f[k] = v;
    } else POS.push(args[i]);
  }
  return f;
}

/* Agents read piped output: drop ANSI colors there, they only cost tokens. */
const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
function log(msg)   { process.stdout.write((COLOR ? msg : String(msg).replace(/\x1b\[[0-9;]*m/g, '')) + '\n'); }
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
  'shots.js',
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
    const seed = fs.readFileSync(path.join(SELF, 'templates', 'ROADMAP.seed.md'), 'utf8')
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

  /* 4. Agent protocol: a native skill for Claude Code (loaded only when relevant),
        otherwise SKILL.md at the root — or .visual-roadmap/ when that name is taken. */
  const usesClaude = FLAGS.hooks || fs.existsSync(path.join(CWD, 'CLAUDE.md')) || fs.existsSync(path.join(CWD, '.claude'));
  const skillPath = installSkill(usesClaude);

  /* 5. Point the project's agent instructions at the protocol */
  if (!FLAGS['no-agents']) installAgentSnippet(skillPath);

  /* 6. Claude Code hooks: automatic brief at session start, check at stop */
  if (!FLAGS['no-hooks'] && usesClaude) installHooks();

  log('');
  log(bold('  ¡Listo para usar!'));
  log(`  Ejecuta ${bold('visual-roadmap live')} para ver ${bold(path.relative(CWD, roadmapFile))} en vivo.`);
  log('  El agente actualiza tareas y estimaciones cuando cambian, sin escrituras periódicas.');
  log('');
}

/* ── agent instructions (CLAUDE.md / AGENTS.md / Cursor / Copilot) ── */

const SNIPPET_START = '<!-- visual-roadmap:start -->';
const SNIPPET_END   = '<!-- visual-roadmap:end -->';
const AGENT_FILES   = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md', '.cursorrules', '.github/copilot-instructions.md'];

function isOurSkill(file) {
  try { return /^name:\s*visual-roadmap\s*$/m.test(fs.readFileSync(file, 'utf8').slice(0, 400)); } catch { return false; }
}

/** Copy the protocol where the agent will find it; returns its project-relative path. */
function installSkill(forClaude) {
  const src = path.join(SELF, 'SKILL.md');
  const candidates = forClaude
    ? [path.join(CWD, '.claude', 'skills', 'visual-roadmap', 'SKILL.md')]
    : [path.join(CWD, 'SKILL.md'), path.join(CWD, '.visual-roadmap', 'SKILL.md')];
  const dest = candidates.find(f => !fs.existsSync(f) || isOurSkill(f)) || candidates[candidates.length - 1];
  const rel = path.relative(CWD, dest).replace(/\\/g, '/');
  if (fs.existsSync(dest)) {
    if (!isOurSkill(dest) && !FLAGS.force) { warn(`${rel} exists and is not ours — skipped`); return rel; }
    if (fs.readFileSync(dest, 'utf8') === fs.readFileSync(src, 'utf8')) return rel;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  ok(`Skill    → ${rel}`);
  return rel;
}

/* Kept short on purpose: agents read it every session; the skill holds the detail. */
function agentSnippet(skillPath = 'SKILL.md') {
  return [
    SNIPPET_START,
    '## Roadmap en vivo (visual-roadmap)',
    '',
    `El usuario sigue tu trabajo en \`ROADMAP.md\`. Protocolo: \`${skillPath}\`. Mínimo:`,
    '',
    '- Petición nueva: divídela en tareas verificables de 15–90 min con `npx visual-roadmap add "Resultado" --effort 30m`.',
    '- Obligatorio e implícito: tú ejecutas `start T00X` antes de editar código, `progress T00X 60` al verificar avance y `done T00X --note "evidencia" --next` al terminar. No esperes que el usuario lo pida.',
    '- Bloqueo: `block T00X "causa"`. Pausa: `pause T00X "motivo"` / `resume T00X`. ETA irreal: `eta T00X 20m "razón"`. Al retomar: `status`.',
    '- Commits con el ID (`T00X: …`). Nunca `done` sin evidencia.',
    SNIPPET_END
  ].join('\n');
}

function installAgentSnippet(skillPath) {
  const present = AGENT_FILES.map(f => path.join(CWD, f)).filter(f => fs.existsSync(f));
  const targets = present.length ? present : [path.join(CWD, 'AGENTS.md')];
  for (const file of targets) {
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const block = agentSnippet(skillPath);
    const re = new RegExp(`${SNIPPET_START}[\\s\\S]*?${SNIPPET_END}`);
    const next = re.test(current) ? current.replace(re, block) : (current.trimEnd() ? current.trimEnd() + '\n\n' : '') + block + '\n';
    if (next === current) continue;
    fs.writeFileSync(file, next);
    ok(`${current ? 'Updated' : 'Created'}  → ${path.relative(CWD, file)} (agent instructions)`);
  }
}

function cmdAgents() {
  const skill = ['.claude/skills/visual-roadmap/SKILL.md', '.visual-roadmap/SKILL.md', 'SKILL.md']
    .find(f => isOurSkill(path.join(CWD, f))) || 'SKILL.md';
  if (FLAGS.install) { installAgentSnippet(skill); return; }
  log(agentSnippet(skill));
  log('');
  info(`Add it to ${AGENT_FILES.join(', ')} — or run  visual-roadmap agents --install`);
}

function cmdServe() {
  const port = parseInt(FLAGS.port || FLAGS.p || '3579', 10);
  const file = path.resolve(CWD, FLAGS.file || FLAGS.f || 'ROADMAP.md');

  if (!fs.existsSync(file)) {
    err(`File not found: ${file}`);
    err(`Run  visual-roadmap init  first, or pass  --file path/to/ROADMAP.md`);
    process.exit(1);
  }

  /* Delegate to lib/server.js */
  require('../lib/server.js').serve({ file, port });
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
  const server = require('../lib/server.js').serve({ file, port });
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
  log('  ' + bold('agents') + '         Print (or --install) the CLAUDE.md / AGENTS.md snippet');
  log('  ' + bold('hooks') + '          Print (or --install) the Claude Code hooks');
  log('');
  log(bold('  Agent commands') + dim('  (nearest ROADMAP.md upwards; --file to override)'));
  log('');
  log('  ' + bold('status') + '   [--json]                Current task, ETA, next ready tasks, problems');
  log('  ' + bold('shot') + '     [ID] <image> ["caption"] [--final]  Attach a screenshot to the task');
  log('  ' + bold('shots') + '    [ID] [--json] | prune   List or prune screenshots');
  log('  ' + bold('add') + '      "Result" --effort 30m [--release "v0.2 · Name"] [--group "Subgroup"] [--after T003]');
  log('  ' + bold('split') + '    T005 "Part A:30m" "Part B:45m"   Replace a task with ordered parts');
  log('  ' + bold('check') + '    [--json] [--strict]     Validate ROADMAP.md; exit 1 on errors');
  log('  ' + bold('start') + '    T002 [--expected 40m]   Mark active, set now_task and start time');
  log('  ' + bold('done') + '     T002 [--note "…"] [--next]  Close (real time + git lines auto), start next');
  log('  ' + bold('block') + '    T003 "reason"           Mark blocked and log the cause');
  log('  ' + bold('pause') + '    T003 "reason"           Pause the work clock');
  log('  ' + bold('resume') + '   T003                    Resume the work clock');
  log('  ' + bold('progress') + ' T002 60                 Set verified progress');
  log('  ' + bold('eta') + '      T002 25m "reason"       Record remaining time and why it changed');
  log('  ' + bold('log') + '      "message" [--icon ✓]    Add a line to Recent changes');
  log('');
  log(bold('  Flags:'));
  log('');
  log('  ' + bold('init') + ':');
  log('    --project "Name"         Project name  (default: current dir name)');
  log('    --owner   "username"     Owner handle  (default: "you")');
  log('    --file    ROADMAP.md     ROADMAP path  (default: ./ROADMAP.md)');
  log('    --viewer-dir visual-roadmap  Viewer dir  (default: ./visual-roadmap)');
  log('    --force                  Overwrite existing files');
  log('    --no-agents              Do not touch CLAUDE.md / AGENTS.md');
  log('    --hooks / --no-hooks     Force / skip Claude Code skill + hooks (auto if CLAUDE.md or .claude/)');
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

/* ── agent commands ───────────────────────────────────── */

/** Nearest ROADMAP.md from the working directory up to the repository root, or --file. */
function roadmapPath() {
  if (FLAGS.file || FLAGS.f) return path.resolve(CWD, FLAGS.file || FLAGS.f);
  for (let dir = CWD; ; dir = path.dirname(dir)) {
    const p = path.join(dir, 'ROADMAP.md');
    if (fs.existsSync(p)) return p;
    if (fs.existsSync(path.join(dir, '.git')) || path.dirname(dir) === dir) break;
  }
  return path.join(CWD, 'ROADMAP.md');
}

function lang() {
  if (FLAGS.lang === 'es' || FLAGS.lang === 'en') return FLAGS.lang;
  return /^es/i.test(process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale || '') ? 'es' : 'en';
}

const ICON = { error: '\x1b[31m✗\x1b[0m', warn: '\x1b[33m⚠\x1b[0m', info: '\x1b[36mℹ\x1b[0m' };

function agentCommand(run) {
  const file = roadmapPath();
  if (!fs.existsSync(file)) {
    err(`ROADMAP.md not found from ${CWD}. Run  visual-roadmap init  first, or pass --file.`);
    process.exit(1);
  }
  const Agent = require('../lib/agent.js');
  try {
    const result = run(Agent, fs.readFileSync(file, 'utf8'));
    if (result && typeof result.text === 'string') {
      fs.writeFileSync(file, result.text);
      const parts = [];
      if (result.ids) parts.push(`${result.ids.join(', ')} created`);
      else if (result.id) parts.push(`${result.id} ${{ start: 'started', block: 'blocked', eta: 'ETA revised', progress: 'progress set', add: 'added' }[CMD] || CMD}`);
      if (result.actual) parts.push(`real ${result.actual}`);
      if (result.diff) parts.push(result.diff);
      if (result.next || result.started) parts.push(`now ${result.next || result.started}`);
      else if (CMD === 'done') { const r = Agent.readyNext(result.text, result.id); parts.push(r ? `next ready ${r}` : 'no ready task left'); }
      ok(parts.length ? parts.join(' · ') : `${path.relative(CWD, file) || file} updated`);
      (result.warnings || []).forEach(w => warn(w));
      Agent.check(result.text, lang()).filter(i => i.level === 'error').forEach(i => err(i.text));
    }
  } catch (e) {
    err(e.message);
    process.exit(1);
  }
}

function cmdStatus() {
  agentCommand((Agent, text) => {
    const s = Agent.status(text, Date.now(), lang());
    if (FLAGS.json) { log(JSON.stringify(s, null, 2)); return; }
    log(`${bold(s.title)}  ${s.done}/${s.total} tasks · ${s.progress}%${s.projectEta ? ' · project ETA ' + s.projectEta : ''}`);
    if (s.active) {
      const a = s.active;
      log(`  now    ${bold(a.id || '—')} ${a.name} · ${a.elapsedMinutes ?? '?'}m elapsed${a.etaAt ? ' · ETA ' + a.etaAt : ''}`);
      if (a.overdue) log(gold(`         ETA passed — revise: visual-roadmap eta ${a.id} <remaining> "reason"`));
    } else log('  now    ' + dim('no active task — visual-roadmap start <ID> --expected 30m'));
    s.blocked.forEach(b => log(`  ${ICON.error} blocked ${b.id} ${b.name}`));
    s.next.forEach(n => log(`  next   ${n.id} ${n.name}${n.effort ? dim(' · ' + n.effort) : ''}`));
    s.issues.filter(i => i.level !== 'info').forEach(i => log(`  ${ICON[i.level]} ${i.text}`));
    const hints = s.issues.filter(i => i.level === 'info').length;
    if (hints) log(dim(`  ${hints} suggestion(s): visual-roadmap check`));
  });
}

function cmdCheck() {
  agentCommand((Agent, text) => {
    const issues = Agent.check(text, lang());
    if (FLAGS.json) log(JSON.stringify(issues, null, 2));
    else if (!issues.length) ok('ROADMAP.md is consistent');
    else issues.forEach(i => log(`${ICON[i.level]}  ${i.text}`));
    if (issues.some(i => i.level === 'error' || (FLAGS.strict && i.level === 'warn'))) process.exitCode = 1;
  });
}

/* ── Claude Code hooks ───────────────────────────────── */

/* SessionStart: print the brief (Claude Code adds stdout to the context).
   Stop: exit 2 with a one-line reason when the roadmap needs attention; Claude
   Code feeds stderr back to the agent. `stop_hook_active` prevents loops.
   UserPromptSubmit: same checks, but it never blocks the prompt. */
/* PostToolUse: keep screenshots the agent takes while a task is active.
   Never interrupts the agent: every failure is ignored. */
function captureShot(input, base, file, text, Agent) {
  try {
    if (process.env.VISUAL_ROADMAP_HOOK_DUMP) {
      const trimmed = JSON.stringify(input, (k, v) => typeof v === 'string' && v.length > 200 ? v.slice(0, 64) + '…' : v, 2);
      fs.writeFileSync(process.env.VISUAL_ROADMAP_HOOK_DUMP, trimmed);
    }
    const found = require('../lib/shot-hook.js').fromPayload(input, { cwd: base });
    if (!found) return;
    const active = Agent.status(text).active;
    if (!active?.id) return;
    const Shots = require('../lib/shots.js');
    Shots.add(path.dirname(file), { ...found, task: active.id, throttle: true, ...Shots.optionsFromRoadmap(globalThis.Roadmap.parse(text)) });
  } catch {}
}

/* A hook runs inside someone else's session: whatever goes wrong here (unreadable
   roadmap, git missing, a bug) must never surface as a failed or blocking hook. */
function cmdHook() {
  try { runHook(); } catch { process.exitCode = 0; }
}

function runHook() {
  let input = {};
  try { if (!process.stdin.isTTY) input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch {}
  const base = process.env.CLAUDE_PROJECT_DIR || input.cwd || CWD;
  const file = FLAGS.file ? path.resolve(base, FLAGS.file) : path.join(base, 'ROADMAP.md');
  if (!fs.existsSync(file)) return;
  const Agent = require('../lib/agent.js');
  const text = fs.readFileSync(file, 'utf8');
  const event = POS[0];
  if (event === 'post-tool-use') captureShot(input, base, file, text, Agent);

  if (event === 'session-start') { log(Agent.brief(text, Date.now(), lang())); return; }
  if (!['stop', 'post-tool-use', 'user-prompt-submit'].includes(event) || (event === 'stop' && input.stop_hook_active)) return;

  const problems = [];
  Agent.check(text, lang()).filter(i => i.level === 'error').forEach(i => problems.push(i.text));
  const s = Agent.status(text);
  if (s.active && s.active.overdue) {
    problems.push(`${s.active.id} passed its ETA. If finished: visual-roadmap done ${s.active.id} --next. Otherwise: visual-roadmap eta ${s.active.id} <remaining> "reason".`);
  }
  if (!s.active && s.total) {
    /* Code changed but no task is active: the user sees a stale roadmap. Remind once per roadmap update. */
    const updated = globalThis.Forecast.timestamp(globalThis.Roadmap.parse(text).meta.updated);
    const changed = require('../lib/git.js').changesSince(base, updated);
    if (changed.add + changed.del > 0 && s.next.length) {
      const next = s.next[0].id;
      const started = Agent.start(text, next);
      fs.writeFileSync(file, started.text);
      log(`[visual-roadmap] ${next} started automatically after code changes.`);
      return;
    }
    if (changed.add + changed.del > 0) {
      problems.push(`Code changed (+${changed.add} -${changed.del}) with no active task. Add a task and start it.`);
    }
  }
  if (!problems.length) return;
  /* UserPromptSubmit: exit 2 would erase the user's prompt and lock them out, so the
     reminder goes to stdout, which Claude Code adds to the agent's context. */
  if (event === 'user-prompt-submit') { log('[visual-roadmap] ' + problems.join(' · ')); return; }
  process.stderr.write('[visual-roadmap] ' + problems.join(' · ') + '\n');
  process.exitCode = 2;
}

/** How hooks should call this CLI: the local install if present, else this file. */
function selfCommand() {
  const local = path.join(CWD, 'node_modules', 'visual-roadmap', 'bin', 'visual-roadmap.js');
  if (fs.existsSync(local)) return 'npx --no visual-roadmap';
  return `node "${path.join(SELF, 'bin', 'visual-roadmap.js').replace(/\\/g, '/')}"`;
}

function installHooks() {
  const file = path.join(CWD, '.claude', 'settings.json');
  let settings = {};
  if (fs.existsSync(file)) {
    try { settings = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { warn(`${path.relative(CWD, file)} is not valid JSON — hooks not installed`); return; }
  }
  const cmd = selfCommand();
  settings.hooks = settings.hooks || {};
  let changed = false;
  for (const [event, arg] of [['SessionStart', 'session-start'], ['Stop', 'stop'], ['PostToolUse', 'post-tool-use'], ['UserPromptSubmit', 'user-prompt-submit']]) {
    const groups = settings.hooks[event] = settings.hooks[event] || [];
    const command = `${cmd} hook ${arg}`;
    const existing = groups.flatMap(g => g.hooks || []).find(h => /visual-roadmap|cli\.js"? hook /.test(h.command || '') && h.command.endsWith(` hook ${arg}`));
    if (existing) { if (existing.command !== command) { existing.command = command; changed = true; } continue; }
    groups.push({ hooks: [{ type: 'command', command, timeout: 15 }] });
    changed = true;
  }
  if (!changed) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  ok(`Hooks    → ${path.relative(CWD, file)} (SessionStart, Stop, PostToolUse, UserPromptSubmit)`);
}

function cmdHooks() {
  if (FLAGS.install) { installHooks(); return; }
  log(`SessionStart: ${selfCommand()} hook session-start`);
  log(`Stop:         ${selfCommand()} hook stop`);
  log(`PostToolUse:  ${selfCommand()} hook post-tool-use`);
  log(`UserPromptSubmit: ${selfCommand()} hook user-prompt-submit`);
  info('Install into .claude/settings.json with  visual-roadmap hooks --install');
}

const rest = from => POS.slice(from).join(' ') || (typeof FLAGS.reason === 'string' ? FLAGS.reason : '');
const cmdStart    = () => agentCommand((A, text) => A.start(text, POS[0], { expected: FLAGS.expected, context: FLAGS.context }));
const cmdDone     = () => agentCommand((A, text) => A.done(text, POS[0], {
  actual: FLAGS.actual, note: FLAGS.note, diff: FLAGS.diff, next: FLAGS.next,
  diffSince: since => require('../lib/git.js').changesSince(path.dirname(roadmapPath()), since)
}));
const cmdAdd      = () => agentCommand((A, text) => A.add(text, POS.join(' '), { effort: FLAGS.effort, release: FLAGS.release, group: FLAGS.group, depends: FLAGS.depends, after: FLAGS.after, note: FLAGS.note }));
const cmdSplit    = () => agentCommand((A, text) => A.split(text, POS[0], POS.slice(1)));
const cmdBlock    = () => agentCommand((A, text) => A.block(text, POS[0], rest(1)));
const cmdPause    = () => agentCommand((A, text) => A.pause(text, POS[0], rest(1)));
const cmdResume   = () => agentCommand((A, text) => A.resume(text, POS[0]));
const cmdProgress = () => agentCommand((A, text) => A.progress(text, POS[0], POS[1]));
const cmdEta      = () => agentCommand((A, text) => A.eta(text, POS[0], POS[1], rest(2)));
const cmdLog      = () => agentCommand((A, text) => A.note(text, rest(0), { icon: FLAGS.icon, diff: FLAGS.diff }));

/* ── screenshots ─────────────────────────────────────── */

function shotContext() {
  const file = roadmapPath();
  if (!fs.existsSync(file)) { err(`ROADMAP.md not found from ${CWD}. Run  visual-roadmap init  first, or pass --file.`); process.exit(1); }
  const Agent = require('../lib/agent.js');
  const text = fs.readFileSync(file, 'utf8');
  return { Agent, text, root: path.dirname(file), Shots: require('../lib/shots.js'), options: require('../lib/shots.js').optionsFromRoadmap(globalThis.Roadmap.parse(text)) };
}

function cmdShot() {
  const { Agent, text, root, Shots, options } = shotContext();
  const args = [...POS];
  const task = /^[A-Za-z]+\d+$/.test(args[0] || '') && !fs.existsSync(path.resolve(CWD, args[0])) ? args.shift() : Agent.status(text).active?.id;
  const image = args.shift();
  if (!task) { err('No active task: pass the task ID (visual-roadmap shot T004 file.png) or start one.'); process.exit(1); }
  if (!image) { err('Usage: visual-roadmap shot [T004] <image> ["caption"] [--final]'); process.exit(1); }
  try {
    const r = Shots.add(root, { task, file: path.resolve(CWD, image), caption: args.join(' '), kind: FLAGS.final ? 'final' : 'progress', source: 'cli', ...options });
    if (r.skipped) info(`${task.toUpperCase()} duplicate, already stored`);
    else ok(`${r.entry.task} shot ${r.entry.id} · ${r.count} shots`);
  } catch (e) { err(e.message); process.exit(1); }
}

function cmdShots() {
  const { root, Shots, options } = shotContext();
  if (POS[0] === 'prune') { ok(`${Shots.prune(root, options).length} file(s) removed`); return; }
  const entries = Shots.list(root, POS[0]);
  if (FLAGS.json) { log(JSON.stringify(entries, null, 2)); return; }
  if (!entries.length) { info('No screenshots yet'); return; }
  entries.forEach(s => log(`${s.task}  ${s.at.slice(0, 16).replace('T', ' ')}  ${s.id}  ${s.kind === 'final' ? '★ ' : ''}${s.caption || path.basename(s.file)}`));
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
  agents:  cmdAgents,
  hook:    cmdHook,
  hooks:   cmdHooks,
  add:     cmdAdd,
  split:   cmdSplit,
  status:  cmdStatus,
  check:   cmdCheck,
  start:   cmdStart,
  done:    cmdDone,
  block:   cmdBlock,
  pause:   cmdPause,
  resume:  cmdResume,
  progress: cmdProgress,
  eta:     cmdEta,
  log:     cmdLog,
  shot:    cmdShot,
  shots:   cmdShots,
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
