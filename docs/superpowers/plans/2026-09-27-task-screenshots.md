# Task Screenshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse the screenshots coding agents already take, attach them to the active task, keep them small, and show them as visual progress in the timeline and the task detail.

**Architecture:** A pure storage module (`lib/shots.js`) owns `.roadmap/shots/` and its `index.json`. The CLI (`shot`, `shots`) and the Claude Code `post-tool-use` hook feed it; the hook uses a separate payload extractor (`lib/shot-hook.js`). The local server exposes the index, the files and a WebP upload endpoint and emits an SSE `shots` event. The viewer loads shots through `viewer/shots.js`, compresses pending ones in the browser, and renders them in the timeline and the task detail.

**Tech Stack:** Node 18+ (`fs`, `path`, `crypto`, `http`), `node:test`, vanilla browser JS/CSS bundled by `scripts/build.js`. Zero dependencies.

**Spec:** `docs/superpowers/specs/2026-09-27-task-screenshots-design.md`

## Global Constraints

- Zero runtime or dev dependencies; Node >= 18.
- Storage root: `.roadmap/shots/` next to `ROADMAP.md`, with its own `.gitignore` containing `*`. Never edit the user's `.gitignore`. `ROADMAP.md` is never modified by this feature.
- Accepted images: PNG, JPEG, WebP detected by magic bytes; max 10 MB each.
- Retention: first + cover + up to 6 intermediate per task; global cap `shots_max_mb` frontmatter (default 150) pruning intermediates of oldest `done` tasks first. First and cover are never deleted.
- Hook: at most one automatic shot per task every 30 s; `Read` only for images modified < 10 min ago, outside `assets/`, `node_modules/`, `dist/`, `.roadmap/`. Any hook error exits 0 silently.
- Browser compression: WebP, width <= 1600 px, quality 0.8, replaces the original only when smaller.
- CLI output: one line (`✓  T011 shot ab12cd34 · 3 shots`).
- The agent protocol gains no obligations; `SKILL.md` only mentions `shot --final` as optional.
- No push and no release until the user reviews locally.

## Review Focus

- A screenshot taken while no task is active must be ignored, not attached to the last task (Task 3 test).
- Path traversal on `GET /shots/file/..%2F..%2FROADMAP.md` must return 404 (Task 4 test).
- A corrupt `index.json` must not crash the hook, the CLI or the server; it is backed up and a new index starts (Task 1 test).
- The same image read twice by the agent (e.g. `Read` after `screenshot`) must be stored once (Task 1 + Task 3 tests).
- Opening `roadmap.html` without the server must not throw or show broken images (Task 5 manual check: `shots.available === false`).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/shots.js` (new) | Storage: sniff, add, list, cover, prune, replace, resolve, options from roadmap. |
| `lib/shot-hook.js` (new) | Extract an image (buffer or file) plus caption/source from a PostToolUse payload. |
| `bin/visual-roadmap.js` | `shot` / `shots` commands; hook capture; help text; `VIEWER_FILES`. |
| `lib/server.js` | `/shots`, `/shots/file/*`, `POST /shots/:id`, SSE `shots`. |
| `viewer/shots.js` (new) | Client store: fetch index, SSE refresh, per-task lookup, background compressor. |
| `viewer/watcher.js` | Forward SSE `shots` events as `roadmap:shots`. |
| `viewer/timeline.js` | Label badge, hover cover preview, capture marks, detail log + lightbox. |
| `viewer/viewer.css`, `viewer/ui.js`, `viewer/index.html`, `scripts/build.js` | Styles, i18n, script include, bundle. |
| `test/shots.test.js`, `test/shot-hook.test.js`, `test/fixtures/hook/*.json` (new), `test/live.test.js` | Tests. |
| `SKILL.md`, `README.md`, `docs/ROADMAP_FORMAT.md`, `CHANGELOG.md`, `package.json`, `scripts/screenshots.js` | Docs, demo shots for README images, exclude `docs/superpowers/` from the package. |

---

### Task 1: Storage module `lib/shots.js`

**Files:**
- Create: `lib/shots.js`
- Test: `test/shots.test.js`

**Interfaces:**
- Produces:
  - `sniff(buffer) → 'png'|'jpeg'|'webp'|null`
  - `add(root, { task, buffer?, file?, caption?, kind?, source?, now?, throttle?, maxMb?, doneTasks? }) → { entry, count, removed } | { skipped: 'duplicate'|'throttled', id? }` (throws on invalid task, size or format)
  - `list(root, task?) → Entry[]` sorted by `at`, only entries whose file exists
  - `cover(entries) → Entry|null`
  - `prune(root, { maxMb, doneTasks }) → string[]` removed relative files
  - `replace(root, id, buffer) → Entry|null`
  - `resolve(root, rel) → string|null` absolute path inside `.roadmap/shots/` or null
  - `readIndex(root) → { version: 1, shots: Entry[], recovered?: true }`
  - `optionsFromRoadmap(doc) → { maxMb, doneTasks }` where `doc = Roadmap.parse(text)`
  - `Entry = { id, task, at, file, caption, kind: 'progress'|'final', source, bytes, compressed }`
  - `root` is always the directory that contains `ROADMAP.md`.

- [ ] **Step 1: Write the failing tests**

```js
// test/shots.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Shots = require('../lib/shots.js');

const PNG = n => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, n)]);
const WEBP = n => Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8, n)]);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vr-shots-'));
const T0 = Date.parse('2026-09-27T14:00:00Z');

test('add stores the image, writes the index and a self-ignoring folder', () => {
  const root = tmp();
  const r = Shots.add(root, { task: 't011', buffer: PNG(1), caption: 'grid', now: T0 });
  assert.equal(r.entry.task, 'T011');
  assert.equal(r.count, 1);
  assert.match(r.entry.file, /^T011\/\d{8}-\d{4}-[0-9a-f]{8}\.png$/);
  assert.ok(fs.existsSync(Shots.resolve(root, r.entry.file)));
  assert.equal(fs.readFileSync(path.join(root, '.roadmap/shots/.gitignore'), 'utf8'), '*\n');
  assert.equal(Shots.list(root, 'T011').length, 1);
});

test('rejects bad task ids, non images and files over 10 MB', () => {
  const root = tmp();
  assert.throws(() => Shots.add(root, { task: '../x', buffer: PNG(1) }), /task/i);
  assert.throws(() => Shots.add(root, { task: 'T1', buffer: Buffer.from('hello') }), /PNG, JPEG or WebP/);
  const big = Buffer.concat([PNG(1), Buffer.alloc(10 * 1024 * 1024)]);
  assert.throws(() => Shots.add(root, { task: 'T1', buffer: big }), /10 MB/);
});

test('same image in the same task is stored once', () => {
  const root = tmp();
  Shots.add(root, { task: 'T1', buffer: PNG(1), now: T0 });
  assert.deepEqual(Shots.add(root, { task: 'T1', buffer: PNG(1), now: T0 + 60000 }).skipped, 'duplicate');
  assert.equal(Shots.list(root).length, 1);
});

test('hook shots are throttled to one per task every 30 s; cli shots are not', () => {
  const root = tmp();
  Shots.add(root, { task: 'T1', buffer: PNG(1), source: 'hook:chrome', throttle: true, now: T0 });
  assert.equal(Shots.add(root, { task: 'T1', buffer: PNG(2), source: 'hook:chrome', throttle: true, now: T0 + 10000 }).skipped, 'throttled');
  assert.ok(Shots.add(root, { task: 'T1', buffer: PNG(3), source: 'cli', now: T0 + 10000 }).entry);
  assert.ok(Shots.add(root, { task: 'T1', buffer: PNG(4), source: 'hook:chrome', throttle: true, now: T0 + 40000 }).entry);
});

test('cover is the latest final shot, else the latest one', () => {
  const e = (id, at, kind = 'progress') => ({ id, at, kind });
  assert.equal(Shots.cover([e('a', '1'), e('b', '3'), e('c', '2', 'final')]).id, 'c');
  assert.equal(Shots.cover([e('a', '1'), e('b', '3')]).id, 'b');
  assert.equal(Shots.cover([]), null);
});

test('retention keeps first, cover and the 6 latest intermediates per task', () => {
  const root = tmp();
  for (let i = 0; i < 10; i++) Shots.add(root, { task: 'T1', buffer: PNG(i), now: T0 + i * 60000 });
  const kept = Shots.list(root, 'T1');
  assert.equal(kept.length, 8);
  assert.equal(kept[0].at, new Date(T0).toISOString());
  assert.equal(kept.at(-1).at, new Date(T0 + 9 * 60000).toISOString());
  assert.equal(fs.readdirSync(path.join(root, '.roadmap/shots/T1')).length, 8);
});

test('global cap prunes intermediates of the oldest done tasks first', () => {
  const root = tmp();
  for (const task of ['T1', 'T2']) for (let i = 0; i < 4; i++) Shots.add(root, { task, buffer: PNG(i + (task === 'T2' ? 10 : 0)), now: T0 + i * 60000 });
  const removed = Shots.prune(root, { maxMb: 0, doneTasks: ['T1', 'T2'] });
  assert.equal(removed.length, 4);
  assert.deepEqual(Shots.list(root).map(s => s.task).sort(), ['T1', 'T1', 'T2', 'T2']);
});

test('resolve rejects paths outside the shots folder', () => {
  const root = tmp();
  assert.equal(Shots.resolve(root, '../../ROADMAP.md'), null);
  assert.equal(Shots.resolve(root, ''), null);
  assert.ok(Shots.resolve(root, 'T1/a.png').endsWith(path.join('.roadmap', 'shots', 'T1', 'a.png')));
});

test('replace swaps in a smaller WebP and keeps the original id', () => {
  const root = tmp();
  const { entry } = Shots.add(root, { task: 'T1', buffer: PNG(1), now: T0 });
  const out = Shots.replace(root, entry.id, WEBP(1));
  assert.equal(out.compressed, true);
  assert.match(out.file, /\.webp$/);
  assert.ok(!fs.existsSync(Shots.resolve(root, entry.file)));
  assert.equal(Shots.add(root, { task: 'T1', buffer: PNG(1), now: T0 + 60000 }).skipped, 'duplicate');
  assert.throws(() => Shots.replace(root, entry.id, PNG(2)), /WebP/);
});

test('a corrupt index is backed up and a new one starts', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.roadmap/shots'), { recursive: true });
  fs.writeFileSync(path.join(root, '.roadmap/shots/index.json'), '{nope');
  assert.equal(Shots.readIndex(root).recovered, true);
  assert.ok(fs.existsSync(path.join(root, '.roadmap/shots/index.json.bak')));
  assert.ok(Shots.add(root, { task: 'T1', buffer: PNG(1) }).entry);
});

test('optionsFromRoadmap reads shots_max_mb and done tasks oldest first', () => {
  const doc = { meta: { shots_max_mb: '20' }, items: [
    { taskId: 'T2', status: 'done', end: '2026-09-27 15:00' },
    { taskId: 'T1', status: 'done', end: '2026-09-27 14:00' },
    { taskId: 'T3', status: 'active', end: '' }] };
  assert.deepEqual(Shots.optionsFromRoadmap(doc), { maxMb: 20, doneTasks: ['T1', 'T2'] });
  assert.equal(Shots.optionsFromRoadmap({ meta: {}, items: [] }).maxMb, 150);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/shots.test.js`
Expected: FAIL with `Cannot find module '../lib/shots.js'`

- [ ] **Step 3: Implement `lib/shots.js`**

```js
/* lib/shots.js — screenshots attached to tasks.
   Stores images under .roadmap/shots/<TASK>/ next to ROADMAP.md with an
   index.json. The folder ignores itself in git. Pure fs; no dependencies. */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join('.roadmap', 'shots');
const MAX_BYTES = 10 * 1024 * 1024;
const KEEP_MIDDLE = 6;
const THROTTLE_MS = 30000;
const DEFAULT_MAX_MB = 150;
const EXT = { png: 'png', jpeg: 'jpg', webp: 'webp' };

const folder = root => path.join(root, DIR);
const byTime = (a, b) => a.at.localeCompare(b.at);

function sniff(buf) {
  if (!Buffer.isBuffer(buf)) return null;
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function ensure(root) {
  const dir = folder(root);
  fs.mkdirSync(dir, { recursive: true });
  const ignore = path.join(dir, '.gitignore');
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '*\n');
  return dir;
}

function readIndex(root) {
  const file = path.join(folder(root), 'index.json');
  if (!fs.existsSync(file)) return { version: 1, shots: [] };
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(data.shots)) return { version: 1, shots: data.shots };
  } catch {}
  fs.renameSync(file, file + '.bak');
  return { version: 1, shots: [], recovered: true };
}

function writeIndex(root, index) {
  const file = path.join(ensure(root), 'index.json');
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, shots: index.shots }, null, 2));
  fs.renameSync(tmp, file);
}

function resolve(root, rel) {
  const base = path.resolve(folder(root));
  const full = path.resolve(base, String(rel || ''));
  return full.startsWith(base + path.sep) ? full : null;
}

function stamp(ms) {
  const d = new Date(ms), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function cover(entries) {
  const finals = entries.filter(s => s.kind === 'final');
  const pool = finals.length ? finals : entries;
  return pool.reduce((best, s) => (!best || s.at >= best.at ? s : best), null);
}

function keepers(own) {
  if (!own.length) return new Set();
  return new Set([[...own].sort(byTime)[0].id, cover(own).id]);
}

function pruneIndex(root, index, { maxMb = DEFAULT_MAX_MB, doneTasks = [] } = {}) {
  const removed = [];
  const drop = s => {
    index.shots = index.shots.filter(x => x !== s);
    removed.push(s.file);
    const p = resolve(root, s.file);
    if (p) fs.rmSync(p, { force: true });
  };
  index.shots = index.shots.filter(s => { const p = resolve(root, s.file); return p && fs.existsSync(p); });
  for (const task of new Set(index.shots.map(s => s.task))) {
    const own = index.shots.filter(s => s.task === task).sort(byTime);
    const keep = keepers(own);
    const middle = own.filter(s => !keep.has(s.id));
    middle.slice(0, Math.max(0, middle.length - KEEP_MIDDLE)).forEach(drop);
  }
  const limit = maxMb * 1024 * 1024;
  let total = index.shots.reduce((n, s) => n + (s.bytes || 0), 0);
  for (const task of doneTasks.map(t => String(t).toUpperCase())) {
    if (total <= limit) break;
    const own = index.shots.filter(s => s.task === task).sort(byTime);
    const keep = keepers(own);
    for (const s of own) {
      if (total <= limit) break;
      if (keep.has(s.id)) continue;
      total -= s.bytes || 0;
      drop(s);
    }
  }
  return removed;
}

function add(root, { task, buffer, file, caption = '', kind = 'progress', source = 'cli', now = Date.now(), throttle = false, maxMb, doneTasks } = {}) {
  if (!/^[A-Za-z]+\d+$/.test(String(task || ''))) throw new Error(`Invalid task id: ${task}`);
  task = task.toUpperCase();
  const buf = buffer || fs.readFileSync(file);
  if (buf.length > MAX_BYTES) throw new Error('Image larger than 10 MB');
  const type = sniff(buf);
  if (!type) throw new Error('Not a PNG, JPEG or WebP image');
  const id = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
  const index = readIndex(root);
  const own = index.shots.filter(s => s.task === task);
  if (own.some(s => s.id === id)) return { skipped: 'duplicate', id };
  if (throttle && own.some(s => String(s.source).startsWith('hook') && now - Date.parse(s.at) < THROTTLE_MS)) return { skipped: 'throttled' };
  ensure(root);
  const rel = `${task}/${stamp(now)}-${id}.${EXT[type]}`;
  fs.mkdirSync(path.join(folder(root), task), { recursive: true });
  fs.writeFileSync(resolve(root, rel), buf);
  const entry = { id, task, at: new Date(now).toISOString(), file: rel, caption: String(caption).slice(0, 200),
    kind: kind === 'final' ? 'final' : 'progress', source, bytes: buf.length, compressed: type === 'webp' };
  index.shots.push(entry);
  const removed = pruneIndex(root, index, { maxMb, doneTasks });
  writeIndex(root, index);
  return { entry, count: index.shots.filter(s => s.task === task).length, removed };
}

function list(root, task) {
  return readIndex(root).shots
    .filter(s => !task || s.task === String(task).toUpperCase())
    .filter(s => { const p = resolve(root, s.file); return p && fs.existsSync(p); })
    .sort(byTime);
}

function prune(root, opts) {
  const index = readIndex(root);
  const removed = pruneIndex(root, index, opts);
  writeIndex(root, index);
  return removed;
}

function replace(root, id, buffer) {
  if (sniff(buffer) !== 'webp') throw new Error('Expected a WebP image');
  if (buffer.length > MAX_BYTES) throw new Error('Image larger than 10 MB');
  const index = readIndex(root);
  const s = index.shots.find(x => x.id === id);
  if (!s) return null;
  if (!s.compressed && buffer.length < s.bytes) {
    const rel = s.file.replace(/\.(png|jpg)$/, '.webp');
    fs.writeFileSync(resolve(root, rel), buffer);
    if (rel !== s.file) fs.rmSync(resolve(root, s.file), { force: true });
    Object.assign(s, { file: rel, bytes: buffer.length });
  }
  s.compressed = true;
  writeIndex(root, index);
  return s;
}

function optionsFromRoadmap(doc) {
  const maxMb = Number(doc?.meta?.shots_max_mb) > 0 ? Number(doc.meta.shots_max_mb) : DEFAULT_MAX_MB;
  const doneTasks = (doc?.items || [])
    .filter(it => it.status === 'done' && it.taskId)
    .sort((a, b) => String(a.end || '').localeCompare(String(b.end || '')))
    .map(it => it.taskId.toUpperCase());
  return { maxMb, doneTasks };
}

module.exports = { sniff, add, list, cover, prune, replace, resolve, readIndex, optionsFromRoadmap };
```

Note on the global-cap test: `maxMb: 0` forces pruning of every intermediate of done tasks; with 4 shots per task, first and cover stay, so 2 per task are removed.

- [ ] **Step 4: Run to verify they pass**

Run: `node --test test/shots.test.js` → all PASS. Then `npm test` → no regressions.

- [ ] **Step 5: Commit**

```bash
git add lib/shots.js test/shots.test.js
git commit -m "feat(shots): storage module with dedupe, retention and compression swap"
```

---

### Task 2: CLI `shot` and `shots` commands

**Files:**
- Modify: `bin/visual-roadmap.js` (add `cmdShot`, `cmdShots`, router entries, help lines; `BOOLEAN_FLAGS` gets `final`)
- Test: `test/shots-cli.test.js`

**Interfaces:**
- Consumes: `Shots.add`, `Shots.list`, `Shots.prune`, `Shots.optionsFromRoadmap`, `Agent.status(text).active.id`, `roadmapPath()`, `globalThis.Roadmap.parse`.
- Produces: `visual-roadmap shot [ID] <file> ["caption"] [--final]` → `✓  T011 shot ab12cd34 · 3 shots` (or `ℹ  T011 duplicate, already stored`); `visual-roadmap shots [ID] [--json]`; `visual-roadmap shots prune` → `✓  N file(s) removed`.

- [ ] **Step 1: Write the failing test**

```js
// test/shots-cli.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, '../bin/visual-roadmap.js');
const PNG = n => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, n)]);
const run = (cwd, ...args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-shot-cli-'));
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), `---\ntitle: Demo\n---\n\n## Releases\n\n### v0.1 · A\n| Item | Estado | Progreso | Esfuerzo | Inicio | Fin | Depende | Real |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| T001 Login | planned | 0% | 30m | — | — | — | — |\n`);
  fs.writeFileSync(path.join(dir, 'a.png'), PNG(1));
  return dir;
}

test('shot without an active task fails in one line', () => {
  const dir = project();
  const r = run(dir, 'shot', 'a.png');
  assert.equal(r.status, 1);
  assert.match(r.stderr + r.stdout, /no active task/i);
});

test('shot attaches to the active task and shots lists it', () => {
  const dir = project();
  run(dir, 'start', 'T001');
  const r = run(dir, 'shot', 'a.png', 'login ok', '--final');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /T001 shot [0-9a-f]{8} · 1 shots/);
  assert.match(run(dir, 'shot', 'T001', 'a.png').stdout, /duplicate/);
  const list = JSON.parse(run(dir, 'shots', '--json').stdout);
  assert.equal(list[0].kind, 'final');
  assert.equal(list[0].caption, 'login ok');
  assert.equal(run(dir, 'shots', 'prune').status, 0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/shots-cli.test.js` → FAIL with `Unknown command: shot`.

- [ ] **Step 3: Implement**

Add `'final'` to `BOOLEAN_FLAGS`. Add before the router:

```js
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
```

(`info`, `ok`, `err`, `log` already exist in the CLI; if `info` does not exist, use `log('ℹ  ' + msg)`.)

Router: `shot: cmdShot, shots: cmdShots,`. Help (`cmdHelp` agent block): 
`log('  ' + bold('shot') + '     [ID] <image> ["caption"] [--final]  Attach a screenshot to the task');`
`log('  ' + bold('shots') + '    [ID] [--json] | prune         List or prune screenshots');`

- [ ] **Step 4: Run** `node --test test/shots-cli.test.js` → PASS; `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add bin/visual-roadmap.js test/shots-cli.test.js
git commit -m "feat(cli): shot and shots commands"
```

---

### Task 3: Automatic capture from the Claude Code hook

**Files:**
- Create: `lib/shot-hook.js`, `test/shot-hook.test.js`, `test/fixtures/hook/chrome-screenshot.json`, `test/fixtures/hook/playwright-screenshot.json`, `test/fixtures/hook/read-image.json`
- Modify: `bin/visual-roadmap.js` (`cmdHook`)

**Interfaces:**
- Consumes: `Shots.add`, `Shots.optionsFromRoadmap`, `Agent.status`.
- Produces: `fromPayload(input, { cwd, now }) → { buffer?|file?, caption, source } | null`; env `VISUAL_ROADMAP_HOOK_DUMP=<file>` makes `hook post-tool-use` write the raw payload (base64 strings truncated to 64 chars) for diagnosing new tools.

- [ ] **Step 1: Capture real payloads (spec risk)**

In a scratch project with `init` done and `.claude/settings.json` hooks, set `VISUAL_ROADMAP_HOOK_DUMP` only after Step 3 exists. Until then, write fixtures from the documented shapes below; after Step 5, run one real Claude Code session with Chrome and Playwright screenshots and replace the fixtures with the dumped payloads if they differ. Record the result in the commit message.

Fixture shapes:

```json
// test/fixtures/hook/chrome-screenshot.json
{ "hook_event_name": "PostToolUse", "tool_name": "mcp__claude-in-chrome__computer",
  "tool_input": { "action": "screenshot", "tabId": 1 },
  "tool_response": [ { "type": "text", "text": "Screenshot of http://localhost:5173/planner" },
                     { "type": "image", "source": { "type": "base64", "media_type": "image/png", "data": "iVBORw0KGgoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" } } ] }
```

```json
// test/fixtures/hook/playwright-screenshot.json
{ "hook_event_name": "PostToolUse", "tool_name": "mcp__playwright__browser_take_screenshot",
  "tool_input": { "filename": "planner.png" },
  "tool_response": { "content": [ { "type": "image", "mimeType": "image/png", "data": "iVBORw0KGgoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" } ] } }
```

```json
// test/fixtures/hook/read-image.json
{ "hook_event_name": "PostToolUse", "tool_name": "Read",
  "tool_input": { "file_path": "shots/planner.png" }, "tool_response": {} }
```

(`iVBORw0KGgo…` decodes to the PNG signature plus zeros, so `sniff` accepts it.)

- [ ] **Step 2: Write the failing tests**

```js
// test/shot-hook.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { fromPayload } = require('../lib/shot-hook.js');

const fixture = name => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/hook', name), 'utf8'));
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 7)]);

test('extracts base64 images from Chrome and Playwright MCP responses', () => {
  const chrome = fromPayload(fixture('chrome-screenshot.json'), { cwd: os.tmpdir() });
  assert.equal(chrome.source, 'hook:chrome');
  assert.equal(chrome.buffer.readUInt32BE(0), 0x89504e47);
  assert.match(chrome.caption, /localhost:5173\/planner/);
  const pw = fromPayload(fixture('playwright-screenshot.json'), { cwd: os.tmpdir() });
  assert.equal(pw.source, 'hook:playwright');
  assert.equal(pw.caption, 'planner.png');
});

test('Read of a fresh image outside ignored folders is a capture', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-hook-'));
  fs.mkdirSync(path.join(cwd, 'shots'));
  fs.writeFileSync(path.join(cwd, 'shots/planner.png'), PNG);
  assert.equal(fromPayload(fixture('read-image.json'), { cwd }).source, 'hook:read');
  assert.equal(fromPayload(fixture('read-image.json'), { cwd, now: Date.now() + 11 * 60000 }), null);
  fs.mkdirSync(path.join(cwd, 'assets'));
  fs.writeFileSync(path.join(cwd, 'assets/logo.png'), PNG);
  assert.equal(fromPayload({ tool_name: 'Read', tool_input: { file_path: 'assets/logo.png' } }, { cwd }), null);
  assert.equal(fromPayload({ tool_name: 'Bash', tool_input: { command: 'ls' } }, { cwd }), null);
});

function hookProject(active) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-hook-run-'));
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), `---\ntitle: Demo\n---\n\n## Releases\n\n### v0.1 · A\n| Item | Estado | Progreso | Esfuerzo | Inicio | Fin | Depende | Real |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| T001 Login | ${active ? 'active' : 'planned'} | 0% | 30m | ${active ? '2026-09-27 14:00' : '—'} | — | — | — |\n`);
  return dir;
}
const hook = (dir, payload) => spawnSync(process.execPath, [path.join(__dirname, '../bin/visual-roadmap.js'), 'hook', 'post-tool-use'],
  { cwd: dir, input: JSON.stringify({ ...payload, cwd: dir }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });

test('hook stores the capture on the active task', () => {
  const dir = hookProject(true);
  hook(dir, fixture('chrome-screenshot.json'));
  const index = JSON.parse(fs.readFileSync(path.join(dir, '.roadmap/shots/index.json'), 'utf8'));
  assert.equal(index.shots.length, 1);
  assert.equal(index.shots[0].task, 'T001');
});

test('hook ignores captures without an active task and never fails on bad input', () => {
  const dir = hookProject(false);
  hook(dir, fixture('chrome-screenshot.json'));
  assert.ok(!fs.existsSync(path.join(dir, '.roadmap/shots/index.json')));
  const bad = spawnSync(process.execPath, [path.join(__dirname, '../bin/visual-roadmap.js'), 'hook', 'post-tool-use'],
    { cwd: dir, input: '{"tool_name":"mcp__x__screenshot","tool_response":{"data":"%%%","mimeType":"image/png"}}', encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  assert.notEqual(bad.status, null);
  assert.ok(!/TypeError|SyntaxError|RangeError/.test(bad.stderr));
});
```

- [ ] **Step 3: Implement `lib/shot-hook.js`**

```js
/* lib/shot-hook.js — find the screenshot in a Claude Code PostToolUse payload.
   MCP tools return images as content blocks ({type:'image', data, mimeType} or
   {source:{type:'base64', media_type, data}}); Read points at a file. */

'use strict';

const fs = require('fs');
const path = require('path');

const IMAGE = /\.(png|jpe?g|webp)$/i;
const SKIP = /(^|[\\/])(assets|node_modules|dist|\.roadmap)([\\/]|$)/;
const FRESH_MS = 10 * 60000;

function findImage(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 6) return null;
  if (Array.isArray(value)) {
    for (const v of value) { const found = findImage(v, depth + 1); if (found) return found; }
    return null;
  }
  const mime = value.mimeType || value.media_type || value.mediaType || value.source?.media_type || '';
  const data = typeof value.data === 'string' ? value.data : typeof value.source?.data === 'string' ? value.source.data : null;
  if (data && /^image\//.test(mime)) return Buffer.from(data, 'base64');
  for (const v of Object.values(value)) { const found = findImage(v, depth + 1); if (found) return found; }
  return null;
}

function findText(value, depth = 0) {
  if (!value || depth > 4) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(v => findText(v, depth + 1)).find(Boolean) || '';
  if (typeof value === 'object') return value.type === 'text' && typeof value.text === 'string' ? value.text : findText(value.content, depth + 1);
  return '';
}

function fromPayload(input, { cwd = process.cwd(), now = Date.now() } = {}) {
  const name = String(input?.tool_name || '');
  const args = input?.tool_input || {};
  if (/screenshot/i.test(name) || (/computer/i.test(name) && args.action === 'screenshot')) {
    const source = /chrome/i.test(name) ? 'hook:chrome' : /playwright/i.test(name) ? 'hook:playwright' : 'hook:mcp';
    const file = args.filename || args.path || args.filePath;
    const url = (findText(input.tool_response).match(/https?:\/\/\S+/) || [])[0];
    const caption = args.url || url || args.title || (file ? path.basename(file) : '') || name.replace(/^mcp__/, '');
    const buffer = findImage(input.tool_response);
    if (buffer) return { buffer, caption, source };
    if (file) {
      const full = path.resolve(cwd, file);
      if (IMAGE.test(full) && fs.existsSync(full)) return { file: full, caption, source };
    }
    return null;
  }
  if (name === 'Read' && IMAGE.test(String(args.file_path || ''))) {
    const full = path.resolve(cwd, args.file_path);
    if (SKIP.test(path.relative(cwd, full))) return null;
    try { if (now - fs.statSync(full).mtimeMs > FRESH_MS) return null; } catch { return null; }
    return { file: full, caption: path.basename(full), source: 'hook:read' };
  }
  return null;
}

module.exports = { fromPayload, findImage };
```

- [ ] **Step 4: Wire it into `cmdHook`**

In `bin/visual-roadmap.js`, right after `const event = POS[0];` add:

```js
  if (event === 'post-tool-use') captureShot(input, base, file, text, Agent);
```

and above `cmdHook`:

```js
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
```

- [ ] **Step 5: Run** `node --test test/shot-hook.test.js` → PASS; `npm test` → PASS.

- [ ] **Step 6: Validate against a real session** (manual, record outcome)

In a scratch project: `npx visual-roadmap init`, start a task, export `VISUAL_ROADMAP_HOOK_DUMP=$PWD/dump.json` for the Claude Code session, take a screenshot with Chrome MCP and with Playwright MCP, then inspect `dump.json`. If the image block shape differs, add that shape to `findImage`, save the dump (trimmed) as a new fixture, and add an assertion in the first test.

- [ ] **Step 7: Commit**

```bash
git add lib/shot-hook.js bin/visual-roadmap.js test/shot-hook.test.js test/fixtures/hook
git commit -m "feat(hooks): keep agent screenshots on the active task"
```

---

### Task 4: Server endpoints and SSE event

**Files:**
- Modify: `lib/server.js` (header comment, routes, watcher of `index.json`)
- Test: `test/live.test.js` (new test)

**Interfaces:**
- Consumes: `Shots.readIndex`, `Shots.resolve`, `Shots.replace`, `Shots.list`.
- Produces: `GET /shots` → `{ version, shots: Entry[] }`; `GET /shots/file/<rel>` → image; `POST /shots/<id>` (body `image/webp`) → `Entry` JSON or 404/400/413; SSE `event: shots` with `data: {"at":<ms>}` when `index.json` changes.

- [ ] **Step 1: Write the failing test** (append to `test/live.test.js`, reusing its helpers)

```js
test('serves screenshots safely and streams index changes', { timeout: 12000 }, async () => {
  const Shots = require('../lib/shots.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-roadmap-'));
  const file = path.join(dir, 'ROADMAP.md');
  fs.writeFileSync(file, '# Shots\n');
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(256, 1)]);
  const { entry } = Shots.add(dir, { task: 'T1', buffer: png });
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(__dirname, '../bin/visual-roadmap.js'), 'serve', '--file', file, '--port', String(port)], { stdio: 'ignore' });
  const url = `http://127.0.0.1:${port}/`;
  try {
    await waitForServer(url);
    const index = await (await fetch(url + 'shots')).json();
    assert.equal(index.shots[0].id, entry.id);
    const img = await fetch(url + 'shots/file/' + entry.file);
    assert.equal(img.headers.get('content-type'), 'image/png');
    assert.equal((await fetch(url + 'shots/file/..%2F..%2FROADMAP.md')).status, 404);
    assert.equal((await fetch(url + 'shots/file/T1/missing.png')).status, 404);
    const sse = (await fetch(url + 'sse')).body.getReader();
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8, 1)]);
    const posted = await fetch(url + 'shots/' + entry.id, { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: webp });
    assert.equal(posted.status, 200);
    assert.match((await posted.json()).file, /\.webp$/);
    let buffer = '';
    for (let i = 0; i < 20 && !/event: shots/.test(buffer); i++) buffer += new TextDecoder().decode((await sse.read()).value);
    assert.match(buffer, /event: shots/);
    sse.cancel();
    assert.equal((await fetch(url + 'shots/nope', { method: 'POST', body: webp })).status, 404);
  } finally { child.kill(); }
});
```

- [ ] **Step 2: Run** `node --test test/live.test.js` → new test FAILS (404 on `/shots`).

- [ ] **Step 3: Implement in `lib/server.js`**

Add after the `broadcast` function:

```js
  const Shots = require('./shots.js');
  const root = path.dirname(file);
  const shotsIndex = path.join(root, '.roadmap', 'shots', 'index.json');
  let shotsMtime = 0;
  function broadcastShots() {
    const payload = `event: shots\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`;
    for (const res of clients) { try { res.write(payload); } catch { clients.delete(res); } }
  }
  function checkShots() {
    try {
      const m = fs.statSync(shotsIndex).mtimeMs;
      if (m !== shotsMtime) { const first = shotsMtime === 0; shotsMtime = m; if (!first) broadcastShots(); }
    } catch {}
  }
  checkShots();
```

Call `checkShots()` at the end of the existing `poll` interval callback (outside its `try`), so index changes are detected every 1.5 s. Add routes before the `/content` route:

```js
    if (url.pathname === '/shots' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ version: 1, shots: Shots.list(root) }));
      return;
    }
    if (url.pathname.startsWith('/shots/file/') && req.method === 'GET') {
      let rel;
      try { rel = decodeURIComponent(url.pathname.slice('/shots/file/'.length)); } catch { rel = ''; }
      const full = Shots.resolve(root, rel);
      if (!full || !/\.(png|jpe?g|webp)$/i.test(full) || !fs.existsSync(full)) { res.writeHead(404); res.end(); return; }
      const type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }[full.split('.').pop().toLowerCase()];
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'max-age=31536000, immutable' });
      fs.createReadStream(full).pipe(res);
      return;
    }
    const upload = /^\/shots\/([0-9a-f]{8})$/.exec(url.pathname);
    if (req.method === 'POST' && url.pathname.startsWith('/shots/')) {
      if (!upload) { res.writeHead(404); res.end(); return; }
      const chunks = []; let size = 0;
      req.on('data', c => { size += c.length; if (size > 10 * 1024 * 1024) { res.writeHead(413); res.end(); req.destroy(); } else chunks.push(c); });
      req.on('end', () => {
        if (res.writableEnded) return;
        try {
          const entry = Shots.replace(root, upload[1], Buffer.concat(chunks));
          if (!entry) { res.writeHead(404); res.end(); return; }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(entry));
        } catch (e) { res.writeHead(400); res.end(e.message); }
      });
      return;
    }
```

Update the header comment protocol list with the three routes and the `shots` event. The existing origin/host check already restricts callers to the local viewer.

- [ ] **Step 4: Run** `node --test test/live.test.js` → PASS; `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/server.js test/live.test.js
git commit -m "feat(server): screenshot index, files, WebP upload and SSE event"
```

---

### Task 5: Viewer data layer and background compressor

**Files:**
- Create: `viewer/shots.js`
- Modify: `viewer/watcher.js` (SSE `shots` listener), `viewer/index.html` (script tag after `forecast.js`), `scripts/build.js` (bundle `shots.js` in the same order), `bin/visual-roadmap.js` (`VIEWER_FILES` gets `'shots.js'`), `viewer/app.js` (init + re-render on change)

**Interfaces:**
- Produces (browser global `RoadmapShots`):
  - `init()` — fetch index when served over http; no-op otherwise.
  - `available: boolean` — true once `/shots` answered.
  - `forTask(taskId) → Entry[]` sorted by `at`.
  - `coverFor(taskId) → Entry|null`.
  - `url(entry) → string` (`/shots/file/<encoded rel>`).
  - Emits `document` event `roadmap:shots-updated` after each load.

- [ ] **Step 1: Implement `viewer/shots.js`**

```js
/* viewer/shots.js — screenshots attached to tasks (served by visual-roadmap live).
   Loads /shots, refreshes on the SSE "shots" event and compresses new images
   to WebP in the background so the folder stays small. */
(function (global) {
  'use strict';
  let entries = [];
  const failed = new Set();
  let queue = Promise.resolve();
  const api = { available: false };

  const served = () => /^https?:$/.test(location.protocol);
  api.url = entry => `/shots/file/${entry.file.split('/').map(encodeURIComponent).join('/')}`;
  api.forTask = id => entries.filter(s => s.task === String(id || '').toUpperCase());
  api.coverFor = id => {
    const own = api.forTask(id);
    const finals = own.filter(s => s.kind === 'final');
    return (finals.length ? finals : own).at(-1) || null;
  };

  async function load() {
    if (!served()) return;
    try {
      const res = await fetch('/shots', { cache: 'no-store' });
      if (!res.ok) return;
      entries = ((await res.json()).shots || []).sort((a, b) => a.at.localeCompare(b.at));
      api.available = true;
      document.dispatchEvent(new CustomEvent('roadmap:shots-updated'));
      entries.filter(s => !s.compressed && !failed.has(s.id)).forEach(s => { queue = queue.then(() => compress(s)); });
    } catch {}
  }

  function idle() { return new Promise(r => (global.requestIdleCallback || setTimeout)(r)); }

  async function compress(entry) {
    await idle();
    try {
      const img = new Image();
      img.src = api.url(entry);
      await img.decode();
      const scale = Math.min(1, 1600 / img.naturalWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.8));
      if (!blob || blob.type !== 'image/webp') throw new Error('no webp');
      const res = await fetch(`/shots/${entry.id}`, { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: blob });
      if (!res.ok) throw new Error(String(res.status));
    } catch { failed.add(entry.id); }
  }

  api.init = () => {
    load();
    document.addEventListener('roadmap:shots', load);
  };
  global.RoadmapShots = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

(The server always answers 200 and marks `compressed: true` even when the WebP is not smaller, so each image is attempted once.)

- [ ] **Step 2: Forward the SSE event** — in `viewer/watcher.js` `setupSSE`, after the `roadmap` listener:

```js
    _sse.addEventListener('shots', () => document.dispatchEvent(new CustomEvent('roadmap:shots')));
```

- [ ] **Step 3: Include the script** — `viewer/index.html`: `<script src="shots.js"></script>` after `forecast.js`; `scripts/build.js`: read `shots.js` and inline it right after `forecast.js` following the existing pattern; `bin/visual-roadmap.js`: add `'shots.js'` to `VIEWER_FILES`.

- [ ] **Step 4: Init and re-render** — in `viewer/app.js` startup (next to `paintNotify();`):

```js
    global.RoadmapShots?.init();
    document.addEventListener('roadmap:shots-updated', () => { if (_doc) render(_doc); });
```

(Use whatever variable holds the last parsed document and the render entry point in `app.js`; `grep -n "function render\|_doc" viewer/app.js` to confirm the names before editing.)

- [ ] **Step 5: Verify** — `npm test` → PASS; `npm run build`; run `node bin/visual-roadmap.js serve --file <scratch>/ROADMAP.md` with one PNG added via `shot`; open the page and check in the console that `RoadmapShots.available === true`, then within a few seconds `index.json` shows `compressed: true` and a `.webp` file. Open `dist/roadmap.html` directly from disk and check the console shows no errors and `RoadmapShots.available === false`.

- [ ] **Step 6: Commit**

```bash
git add viewer/shots.js viewer/watcher.js viewer/index.html viewer/app.js scripts/build.js bin/visual-roadmap.js dist/roadmap.html
git commit -m "feat(viewer): load task screenshots and compress them to WebP"
```

---

### Task 6: Timeline — badge, cover preview, capture marks

**Files:**
- Modify: `viewer/timeline.js` (task rows), `viewer/viewer.css`, `viewer/ui.js` (i18n)

**Interfaces:**
- Consumes: `RoadmapShots.available`, `forTask`, `coverFor`, `url`; existing `pos(ms)`, `zoom`, bar element per item.
- Produces: CSS classes `.shot-badge`, `.shot-mark`, `.shot-preview`; i18n keys `shots`, `shotsServeOnly`, `shotSource`.

- [ ] **Step 1: Label badge** — in the `items.forEach` block, after the label row `l` is created:

```js
        const shots = global.RoadmapShots?.available ? global.RoadmapShots.forTask(it.taskId) : [];
        if (shots.length) {
          const badge = el('span', 'shot-badge', `📷 ${shots.length}`);
          badge.title = `${shots.length} ${t('shots')}`;
          l.appendChild(badge);
        }
```

- [ ] **Step 2: Capture marks** — when `bar` exists and `zoom` is `'6h'` or `'1d'`:

```js
        if (bar && shots.length && (zoom === '6h' || zoom === '1d')) {
          shots.forEach(s => {
            const at = Date.parse(s.at);
            if (at < start || at > end) return;
            const mark = el('span', 'shot-mark');
            mark.style.left = `${pos(at)}%`;
            mark.title = `${global.Forecast.dateTime(at)} · ${s.caption || ''}`;
            mark.addEventListener('click', e => { e.stopPropagation(); showDetail(it, doc, forecast, s.id); });
            bar.parentElement.appendChild(mark);
          });
        }
```

(`bar.parentElement` is the row, so place this after `row(...)` has appended the bar.)

- [ ] **Step 3: Cover preview on hover** — one shared element per render:

```js
    const preview = el('div', 'shot-preview'); preview.hidden = true; document.body.appendChild(preview);
    // inside items.forEach, when bar exists:
        const coverShot = shots.length ? global.RoadmapShots.coverFor(it.taskId) : null;
        if (bar && coverShot) {
          bar.addEventListener('mouseenter', e => {
            preview.replaceChildren(Object.assign(document.createElement('img'), { src: global.RoadmapShots.url(coverShot), alt: coverShot.caption || it.name }));
            const r = bar.getBoundingClientRect();
            preview.style.left = `${Math.min(innerWidth - 260, r.left)}px`;
            preview.style.top = `${r.bottom + 6}px`;
            preview.hidden = false;
          });
          bar.addEventListener('mouseleave', () => { preview.hidden = true; });
        }
```

At the top of `render`, remove any previous preview: `document.querySelector('.shot-preview')?.remove();`.

- [ ] **Step 4: Styles**

```css
.shot-badge { margin-left: 6px; padding: 0 5px; border: 1px solid rgba(0,212,255,.35); border-radius: 8px; font-size: 9px; color: var(--cyan); }
.shot-mark { position: absolute; top: 2px; width: 7px; height: 7px; margin-left: -3px; border-radius: 50%; background: #fff; border: 1px solid var(--cyan); box-shadow: 0 0 6px var(--cyan-glow); cursor: pointer; z-index: 2; }
.shot-preview { position: fixed; z-index: 50; width: 240px; padding: 4px; background: #07111e; border: 1px solid rgba(0,212,255,.45); box-shadow: 0 8px 28px rgba(0,0,0,.55); pointer-events: none; }
.shot-preview img { display: block; width: 100%; height: auto; }
html[data-theme="light"] .shot-preview { background: #fff; border-color: #9cc8dc; }
html[data-theme="light"] .shot-mark { background: #007ea8; border-color: #fff; }
```

- [ ] **Step 5: i18n** — `ui.js` EN: `shots:'screenshots', shotsServeOnly:'Screenshots are available with visual-roadmap live', shotSource:'source'`; ES: `shots:'capturas', shotsServeOnly:'Las capturas están disponibles con visual-roadmap live', shotSource:'origen'`.

- [ ] **Step 6: Verify** — `npm test`; `npm run build`; serve a scratch roadmap with 3 shots on the active task; screenshot the page at 1440×900 with the Edge headless command used in `scripts/screenshots.js` and inspect: badge on the label, marks on the bar at 6 H, preview does not overflow the right edge.

- [ ] **Step 7: Commit**

```bash
git add viewer/timeline.js viewer/viewer.css viewer/ui.js dist/roadmap.html
git commit -m "feat(timeline): screenshot badge, cover preview and capture marks"
```

---

### Task 7: Task detail — vertical log and lightbox

**Files:**
- Modify: `viewer/timeline.js` (`showDetail(item, doc, forecast, focusShotId?)`), `viewer/viewer.css`, `viewer/ui.js`

**Interfaces:**
- Consumes: `RoadmapShots.*`, `doc.estimateChanges`, `global.RoadmapGit`, `doc.recentChanges`, `item.start`, `item.end`, `item.status`, `item.note`.
- Produces: `showDetail(item, doc, forecast, focusShotId)`; `openLightbox(shots, index)` (module-private); classes `.task-log`, `.task-log__row`, `.task-log__thumb`, `.lightbox`.

- [ ] **Step 1: Build the event list** — replace the separate "estimate history" and "commits" sections of `showDetail` with one log. Keep the existing fields block above it.

```js
    const id = (item.taskId || '').toUpperCase();
    const when = v => global.Forecast.timestamp(v);
    const events = [];
    if (item.start) events.push({ at: when(item.start), icon: '▶', text: t('started') });
    (doc.estimateChanges || []).filter(c => c.taskId.toUpperCase() === id)
      .forEach(c => events.push({ at: when(c.at), icon: '↻', text: `ETA ${c.remaining} · ${c.reason || t('noReason')}` }));
    (global.RoadmapGit || []).filter(c => c.tasks.includes(id))
      .forEach(c => events.push({ at: c.time, icon: '⎇', text: `${c.hash} ${c.subject}`, diff: `+${c.add} -${c.del}` }));
    (doc.recentChanges || []).filter(c => id && c.text?.toUpperCase().includes(id))
      .forEach(c => events.push({ at: when(c.time), icon: c.icon || '•', text: c.text }));
    const shots = global.RoadmapShots?.available ? global.RoadmapShots.forTask(id) : [];
    shots.forEach((s, i) => events.push({ at: Date.parse(s.at), shot: s, index: i }));
    if (item.status === 'done' && item.end) events.push({ at: when(item.end), icon: '✓', text: item.note || t('done') });
    events.sort((a, b) => (a.at || 0) - (b.at || 0));
```

(Before editing, `grep -n "recentChanges\|estimateChanges" viewer/md.js` to confirm field names `time`/`at`/`icon`/`text`; adapt the property names if they differ.)

- [ ] **Step 2: Render the log**

```js
    panel.appendChild(el('h3', 'hud-card__head-label', t('activity')));
    const logEl = el('div', 'task-log');
    events.forEach(ev => {
      const row = el('div', 'task-log__row');
      row.appendChild(el('span', 'task-log__time', ev.at ? global.Forecast.dateTime(ev.at) : '—'));
      if (ev.shot) {
        const thumb = document.createElement('img');
        Object.assign(thumb, { className: 'task-log__thumb', loading: 'lazy', src: global.RoadmapShots.url(ev.shot), alt: ev.shot.caption || item.name });
        thumb.addEventListener('click', () => openLightbox(shots, ev.index));
        const body = el('div', 'task-log__shot');
        body.append(thumb, el('div', 'task-log__caption', `${ev.shot.kind === 'final' ? '★ ' : ''}${ev.shot.caption || ''}`), el('div', 'task-log__meta', ev.shot.source));
        row.append(el('span', 'task-log__icon', '📷'), body);
        if (ev.shot.id === focusShotId) requestAnimationFrame(() => row.scrollIntoView({ block: 'center' }));
      } else {
        row.append(el('span', 'task-log__icon', ev.icon), el('span', 'task-log__text', ev.text));
        if (ev.diff) row.appendChild(el('span', 'task-log__diff', ev.diff));
      }
      logEl.appendChild(row);
    });
    if (!events.length) logEl.appendChild(el('div', 'task-log__empty', t('noActivity')));
    panel.appendChild(logEl);
    if (!global.RoadmapShots?.available) panel.appendChild(el('p', 'task-log__hint', t('shotsServeOnly')));
```

- [ ] **Step 3: Lightbox**

```js
  function openLightbox(shots, index) {
    document.querySelector('.lightbox')?.remove();
    const box = el('div', 'lightbox'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    const img = document.createElement('img'); const caption = el('div', 'lightbox__caption');
    const show = i => {
      index = (i + shots.length) % shots.length;
      const s = shots[index];
      img.src = global.RoadmapShots.url(s); img.alt = s.caption || '';
      caption.textContent = `${index + 1}/${shots.length} · ${global.Forecast.dateTime(Date.parse(s.at))} · ${s.caption || ''}`;
    };
    const close = () => { document.removeEventListener('keydown', onKey, true); box.remove(); };
    const onKey = e => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      else if (e.key === 'ArrowRight') show(index + 1);
      else if (e.key === 'ArrowLeft') show(index - 1);
    };
    box.addEventListener('click', e => { if (e.target === box) close(); });
    document.addEventListener('keydown', onKey, true);
    box.append(img, caption); document.body.appendChild(box); show(index);
  }
```

(The capture-phase listener with `stopPropagation` keeps `Esc` from also closing the detail panel underneath.)

- [ ] **Step 4: Styles** — widen the panel and style the log:

```css
.task-detail-panel { width: min(560px, 100vw); }
.task-log { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; border-left: 1px solid rgba(0,212,255,.25); padding-left: 10px; }
.task-log__row { display: grid; grid-template-columns: 92px 18px 1fr auto; align-items: start; gap: 6px; padding: 5px 0; font-size: 12px; color: #b9d0e2; }
.task-log__time { font: 10px 'JetBrains Mono', monospace; color: #6f8ea8; padding-top: 2px; }
.task-log__diff { font: 10px 'JetBrains Mono', monospace; color: #7fd89a; }
.task-log__shot { grid-column: 3 / -1; }
.task-log__thumb { display: block; width: 100%; max-width: 360px; border: 1px solid rgba(0,212,255,.3); cursor: zoom-in; }
.task-log__caption { margin-top: 4px; color: #e5f4ff; }
.task-log__meta, .task-log__hint, .task-log__empty { font-size: 10px; color: #6f8ea8; }
.lightbox { position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: rgba(2,6,12,.92); }
.lightbox img { max-width: 94vw; max-height: 86vh; box-shadow: 0 10px 40px rgba(0,0,0,.6); }
.lightbox__caption { color: #cfe3f3; font-size: 12px; }
html[data-theme="light"] .task-log__row { color: #2b4a60; }
html[data-theme="light"] .task-log__caption { color: #16364d; }
```

- [ ] **Step 5: i18n** — EN `activity:'ACTIVITY', started:'Started', noActivity:'No activity recorded yet'`; ES `activity:'ACTIVIDAD', started:'Inicio', noActivity:'Sin actividad registrada'`. Reuse existing `done`, `noReason`.

- [ ] **Step 6: Verify** — `npm test`; `npm run build`; with the scratch roadmap from Task 6: click a task → log in time order with thumbnails; click thumbnail → lightbox; ← → cycle; `Esc` closes only the lightbox; click a mark in the timeline → detail opens scrolled to that shot. Check light theme.

- [ ] **Step 7: Commit**

```bash
git add viewer/timeline.js viewer/viewer.css viewer/ui.js dist/roadmap.html
git commit -m "feat(detail): activity log with screenshots and lightbox"
```

---

### Task 8: Docs, demo screenshots and packaging

**Files:**
- Modify: `SKILL.md`, `templates` copy of the skill if `init` embeds text (check `grep -n "SKILL" bin/visual-roadmap.js`), `README.md`, `docs/ROADMAP_FORMAT.md`, `CHANGELOG.md` (`[Unreleased]`), `package.json` (`files`), `scripts/screenshots.js`, `bin/visual-roadmap.js` (init agent block if it lists commands)

- [ ] **Step 1: SKILL.md** — add to the command table one row: `| Captura que demuestra el resultado (opcional) | \`shot T004 captura.png "qué demuestra" --final\` |` and one sentence under Reglas: "Las capturas que tomes con Chrome/Playwright se guardan solas en la tarea activa (Claude Code); no hace falta ejecutar nada."
- [ ] **Step 2: README** — Features bullet "**Screenshots as progress**", Agent Commands rows for `shot`/`shots`, a sentence in "How It Works", and `.roadmap/shots/` in the troubleshooting table ("Disk usage: `shots_max_mb` in the frontmatter, `visual-roadmap shots prune`").
- [ ] **Step 3: ROADMAP_FORMAT.md** — document the optional frontmatter key `shots_max_mb` (default 150).
- [ ] **Step 4: CHANGELOG** — under `[Unreleased]` → `### Added`: shot/shots commands, automatic capture hook, timeline badge/preview/marks, activity log with lightbox, browser WebP compression, retention.
- [ ] **Step 5: package.json** — change `"docs/"` in `files` to `"docs/ROADMAP_FORMAT.md", "docs/DEVELOPMENT.md"` so `docs/superpowers/` is not published.
- [ ] **Step 6: Demo shots for README images** — in `scripts/screenshots.js`, after writing the demo `ROADMAP.md`, generate 3 small solid-color PNGs in memory (write a minimal PNG encoder with `zlib.deflateSync` and CRC32 — ~25 lines) and add them with `Shots.add(dir, { task: '<active demo task id>', buffer, caption, now })` at increasing times, the last with `kind: 'final'`; add a 4th shot `['task-detail.png', 'view=timeline&theme=dark&lang=en&task=<id>', '1440,900']` only if the viewer supports a `task=` query to open the detail (add that in `app.js`: after first render, `if (params.get('task')) Timeline.openTask(...)`); otherwise skip the 4th image.
- [ ] **Step 7: Verify** — `npm test`; `npm run build`; `npm run screenshots`; inspect the images; run the end-to-end install check in a scratch project (`npm i -D <repo>`, `init`, `add`, `start`, `shot a.png`, `shots`).
- [ ] **Step 8: Commit** (no push, no tag)

```bash
git add SKILL.md README.md docs/ROADMAP_FORMAT.md CHANGELOG.md package.json scripts/screenshots.js viewer/app.js dist/roadmap.html assets/screenshots
git commit -m "docs: screenshots feature, packaging and demo images"
```
