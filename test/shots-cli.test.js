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
