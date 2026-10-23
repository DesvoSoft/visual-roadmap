const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

require('../viewer/md.js');
require('../viewer/forecast.js');
require('../viewer/trust.js');
const { Roadmap, Forecast, Trust } = globalThis;

const MIN = 60000;
const NOW = new Date('2026-10-23T12:00:00').getTime();
const roadmap = rows => `---
title: Demo
started: 2026-10-23 08:00
updated: 2026-10-23 11:00
---

## Releases

### v0.1 · Demo

| Tarea | Estado | Progreso | Esfuerzo | Inicio | Fin | Depende | Real | Nota |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}
`;
const ACTIVE = roadmap([
  '| T001 First | done | 100% | 1h | 2026-10-23 08:00 | 2026-10-23 09:00 | — | 1h | ok |',
  '| T002 Second | active | 20% | 1h | 2026-10-23 11:00 | — | T001 | — | — |'
]);
const IDLE = roadmap(['| T001 First | done | 100% | 1h | 2026-10-23 08:00 | 2026-10-23 09:00 | — | 1h | ok |']);

function fresh(text, activity, commits = []) {
  const doc = Roadmap.parse(text);
  return Trust.freshness(doc, Forecast.calculate(doc, NOW), activity, commits, NOW);
}

test('active task: live, quiet, then stale as signals age', () => {
  assert.equal(fresh(ACTIVE, { lastWrite: NOW - 2 * MIN, touched: 1 }).state, 'live');
  assert.equal(fresh(ACTIVE, { lastWrite: NOW - 15 * MIN, touched: 1 }).state, 'quiet');
  const stale = fresh(ACTIVE, { lastWrite: NOW - 90 * MIN, roadmapAt: NOW - 60 * MIN, touched: 0 });
  assert.equal(stale.state, 'stale');
  assert.equal(stale.minutes, 60, 'the newest signal counts, here the roadmap write');
  assert.equal(stale.task, 'T002');
});

test('a recent commit keeps an active task live', () => {
  assert.equal(fresh(ACTIVE, { lastWrite: null, touched: 0 }, [{ time: NOW - 3 * MIN }]).state, 'live');
});

test('no active task: recent writes after the roadmap are untracked work', () => {
  assert.equal(fresh(IDLE, { lastWrite: NOW - 5 * MIN, touched: 4 }).state, 'untracked');
  assert.equal(fresh(IDLE, { lastWrite: NOW - 5 * MIN, touched: 0 }).state, 'idle', 'written before the roadmap changed');
  assert.equal(fresh(IDLE, { lastWrite: NOW - 120 * MIN, touched: 4 }).state, 'idle', 'old leftovers');
});

test('without observations there is no verdict', () => {
  assert.equal(fresh(ACTIVE, null), null);
});

test('coverage counts commits that name a task or land inside its work window', () => {
  const doc = Roadmap.parse(ACTIVE);
  const commits = [
    { time: NOW - 10 * MIN, tasks: [] },                                   /* inside T002 (active) */
    { time: new Date('2026-10-23T09:05:00').getTime(), tasks: [] },        /* just after T001 done */
    { time: new Date('2026-10-23T10:00:00').getTime(), tasks: [] },        /* between tasks */
    { time: new Date('2026-10-23T10:30:00').getTime(), tasks: ['T001'] },  /* names a task */
    { time: new Date('2026-10-22T10:00:00').getTime(), tasks: [] }         /* before the roadmap */
  ];
  assert.deepEqual(Trust.coverage(doc, commits, NOW), { covered: 3, total: 4, pct: 75 });
  assert.equal(Trust.coverage(doc, [], NOW), null);
});

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-roadmap-git-'));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, stdio: 'ignore' });
  git('init', '-q');
  return { dir, git };
}

test('commits link to tasks through the Roadmap-Task trailer', () => {
  const { dir, git } = repo();
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
  git('add', '.');
  git('commit', '-q', '-m', 'Add a', '-m', 'Roadmap-Task: T007');
  fs.writeFileSync(path.join(dir, 'b.txt'), 'b\n');
  git('add', '.');
  git('commit', '-q', '-m', 'T003: add b');
  const commits = require('../lib/git.js').recentCommits(dir);
  assert.deepEqual(commits.map(c => c.tasks), [['T003'], ['T007']]);
  assert.deepEqual(commits.map(c => c.add), [1, 1]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('activity snapshot: uncommitted writes after the roadmap, never the roadmap itself', () => {
  const { dir, git } = repo();
  const file = path.join(dir, 'ROADMAP.md');
  fs.writeFileSync(file, '# R\n');
  fs.writeFileSync(path.join(dir, 'old.txt'), 'x\n');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  const past = new Date(Date.now() - 60 * MIN);
  fs.utimesSync(file, past, past);
  fs.writeFileSync(path.join(dir, 'new.js'), 'x\n');
  const Activity = require('../lib/activity.js');
  const snap = Activity.snapshot(dir, file);
  assert.equal(snap.touched, 1);
  assert.deepEqual(snap.paths, ['new.js']);
  assert.ok(snap.lastWrite > past.getTime());
  assert.ok(snap.head && snap.head.hash);
  assert.equal(Activity.changed(snap, { ...snap }), false);
  assert.equal(Activity.changed(snap, { ...snap, touched: 2 }), true);
  fs.rmSync(dir, { recursive: true, force: true });
});
