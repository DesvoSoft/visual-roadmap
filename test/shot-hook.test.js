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
