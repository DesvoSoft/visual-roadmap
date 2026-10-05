const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}
async function waitForServer(url) {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(url + 'ping')).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('live server did not start');
}
async function nextEvent(reader, wanted, timeoutMs = 5000) {
  let buffer = '';
  const timer = setTimeout(() => reader.cancel(), timeoutMs);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) throw new Error('SSE ended before update');
      buffer += new TextDecoder().decode(value);
      const events = buffer.split('\n\n');
      buffer = events.pop();
      for (const event of events) {
        const data = /^data: (.+)$/m.exec(event);
        if (data && JSON.parse(data[1]) === wanted) return;
      }
    }
  } finally { clearTimeout(timer); }
}

async function readUntil(reader, pattern, timeoutMs = 5000) {
  let buffer = '';
  const timer = setTimeout(() => reader.cancel(), timeoutMs);
  try {
    while (!pattern.test(buffer)) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += new TextDecoder().decode(value);
    }
  } finally { clearTimeout(timer); }
  return buffer;
}

test('serves the viewer and streams roadmap changes', { timeout: 12000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-roadmap-'));
  const file = path.join(dir, 'ROADMAP.md');
  fs.writeFileSync(file, '# Initial\n');
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(__dirname, '../bin/visual-roadmap.js'), 'serve', '--file', file, '--port', String(port)], { stdio: 'ignore' });
  const url = `http://127.0.0.1:${port}/`;
  try {
    await waitForServer(url);
    const html = await (await fetch(url)).text();
    assert.match(html, /forecast\.js/);
    assert.equal((await fetch(url + 'content', { headers: { Origin: 'https://other.example' } })).status, 403);
    const response = await fetch(url + 'sse');
    assert.match(response.headers.get('content-type'), /text\/event-stream/);
    const reader = response.body.getReader();
    await nextEvent(reader, '# Initial\n');
    const update = nextEvent(reader, '# Updated\n');
    fs.writeFileSync(file, '# Updated\n');
    await update;
    await reader.cancel();
  } finally {
    child.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('stop hook asks the agent to fix roadmap errors once', () => {
  const { spawnSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-roadmap-hook-'));
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), '---\ntitle: H\n---\n\n## Releases\n### v0.1 · A\n| Item | Estado | Esfuerzo | Depende |\n| --- | --- | --- | --- |\n| T001 Uno | planned | 10m | T404 |\n');
  const run = input => spawnSync(process.execPath, [path.join(__dirname, '../bin/visual-roadmap.js'), 'hook', 'stop'], { cwd: dir, input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  try {
    const first = run({ stop_hook_active: false });
    assert.equal(first.status, 2);
    assert.match(first.stderr, /T404/);
    assert.equal(run({ stop_hook_active: true }).status, 0);
    const brief = spawnSync(process.execPath, [path.join(__dirname, '../bin/visual-roadmap.js'), 'hook', 'session-start'], { cwd: dir, input: '{}', encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
    assert.match(brief.stdout, /^\[visual-roadmap\] H · 0\/1 tasks/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('post-tool hook starts a ready task after code changes', () => {
  const { spawnSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-roadmap-auto-'));
  const cli = path.join(__dirname, '../bin/visual-roadmap.js');
  const run = (bin, args, input) => spawnSync(bin, args, { cwd: dir, input, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  try {
    fs.writeFileSync(path.join(dir, 'ROADMAP.md'), '---\ntitle: Auto\nupdated: 2026-09-26 09:00\n---\n## Releases\n### v1 · Work\n| Item | Estado | Esfuerzo |\n| --- | --- | --- |\n| T001 Ready | planned | 30m |\n');
    fs.writeFileSync(path.join(dir, 'code.js'), 'const x = 1;\n');
    assert.equal(run('git', ['init']).status, 0);
    assert.equal(run('git', ['add', '.']).status, 0);
    assert.equal(run('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'initial']).status, 0);
    fs.writeFileSync(path.join(dir, 'code.js'), 'const x = 2;\n');
    const hook = run(process.execPath, [cli, 'hook', 'post-tool-use'], '{}');
    assert.equal(hook.status, 0);
    assert.match(hook.stdout, /T001 started automatically/);
    assert.match(fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8'), /\| T001 Ready \| active \|/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('user-prompt hook never blocks the prompt: it tells the agent instead', () => {
  const { spawnSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-roadmap-prompt-'));
  const cli = path.join(__dirname, '../bin/visual-roadmap.js');
  const run = (bin, args, input) => spawnSync(bin, args, { cwd: dir, input, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  try {
    fs.writeFileSync(path.join(dir, 'ROADMAP.md'), '---\ntitle: Done\nupdated: 2026-09-26 09:00\n---\n## Releases\n### v1 · Work\n| Item | Estado | Esfuerzo |\n| --- | --- | --- |\n| T001 Finished | done | 30m |\n');
    fs.writeFileSync(path.join(dir, 'code.js'), 'const x = 1;\n');
    assert.equal(run('git', ['init']).status, 0);
    assert.equal(run('git', ['add', '.']).status, 0);
    assert.equal(run('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'initial']).status, 0);
    fs.writeFileSync(path.join(dir, 'code.js'), 'const x = 2;\n');
    const prompt = run(process.execPath, [cli, 'hook', 'user-prompt-submit'], '{}');
    assert.equal(prompt.status, 0);
    assert.equal(prompt.stderr, '');
    assert.match(prompt.stdout, /^\[visual-roadmap\] Code changed .* with no active task/);
    assert.equal(run(process.execPath, [cli, 'hook', 'stop'], '{}').status, 2);
    /* After every tool call the hook stays quiet: the reminder would repeat on each one. */
    const tool = run(process.execPath, [cli, 'hook', 'post-tool-use'], '{"tool_name":"Edit"}');
    assert.deepEqual([tool.status, tool.stdout, tool.stderr], [0, '', '']);
    /* Any roadmap change after the code change settles it: nothing left to remind. */
    fs.appendFileSync(path.join(dir, 'ROADMAP.md'), '\n');
    assert.equal(run(process.execPath, [cli, 'hook', 'user-prompt-submit'], '{}').stdout, '');
    assert.equal(run(process.execPath, [cli, 'hook', 'stop'], '{}').status, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('post-tool hook only reacts to tools that write code, and init limits it to them', () => {
  const { spawnSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-roadmap-tools-'));
  const cli = path.join(__dirname, '../bin/visual-roadmap.js');
  const run = (bin, args, input) => spawnSync(bin, args, { cwd: dir, input, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  try {
    fs.writeFileSync(path.join(dir, 'ROADMAP.md'), '---\ntitle: Auto\n---\n## Releases\n### v1 · Work\n| Item | Estado | Esfuerzo |\n| --- | --- | --- |\n| T001 Ready | planned | 30m |\n');
    assert.equal(run('git', ['init']).status, 0);
    fs.writeFileSync(path.join(dir, 'code.js'), 'const x = 1;\n');
    assert.equal(run(process.execPath, [cli, 'hook', 'post-tool-use'], '{"tool_name":"Grep"}').stdout, '');
    assert.match(fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8'), /\| T001 Ready \| planned \|/);
    assert.match(run(process.execPath, [cli, 'hook', 'post-tool-use'], '{"tool_name":"Write"}').stdout, /T001 started automatically/);
    assert.equal(run(process.execPath, [cli, 'hooks', '--install']).status, 0);
    const hooks = JSON.parse(fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8')).hooks;
    assert.match(hooks.PostToolUse[0].matcher, /^Edit\|Write\|.*mcp__/);
    assert.equal(hooks.Stop[0].matcher, undefined);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('only the stop hook can block: no other event or internal failure exits non-zero', () => {
  const { spawnSync } = require('node:child_process');
  const cli = path.join(__dirname, '../bin/visual-roadmap.js');
  const events = ['session-start', 'user-prompt-submit', 'post-tool-use', 'stop', 'unknown-event'];
  const run = (dir, event, input) => spawnSync(process.execPath, [cli, 'hook', event], { cwd: dir, input, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  const broken = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-roadmap-broken-'));
  const crash = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-roadmap-crash-'));
  try {
    /* A roadmap with errors reaches the agent, but only `stop` blocks. */
    fs.writeFileSync(path.join(broken, 'ROADMAP.md'), '---\ntitle: H\n---\n\n## Releases\n### v0.1 · A\n| Item | Estado | Esfuerzo | Depende |\n| --- | --- | --- | --- |\n| T001 Uno | planned | 10m | T404 |\n');
    const prompt = run(broken, 'user-prompt-submit', 'not json');
    assert.equal(prompt.status, 0);
    assert.match(prompt.stdout, /T404/);
    assert.equal(run(broken, 'stop', '{}').status, 2);
    /* ROADMAP.md cannot be read (it is a directory): the hook stays silent. */
    fs.mkdirSync(path.join(crash, 'ROADMAP.md'));
    for (const event of events) {
      const r = run(crash, event, '{}');
      assert.equal(r.status, 0, event);
      assert.equal(r.stderr, '', event);
    }
  } finally {
    fs.rmSync(broken, { recursive: true, force: true });
    fs.rmSync(crash, { recursive: true, force: true });
  }
});

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
    assert.match(await readUntil(sse, /event: shots/), /event: shots/);
    sse.cancel();
    assert.equal((await fetch(url + 'shots/nope', { method: 'POST', body: webp })).status, 404);
  } finally { child.kill(); }
});

test('announces the first screenshot when the index did not exist at startup', { timeout: 12000 }, async () => {
  const Shots = require('../lib/shots.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-roadmap-'));
  const file = path.join(dir, 'ROADMAP.md');
  fs.writeFileSync(file, '# Fresh\n');
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(__dirname, '../bin/visual-roadmap.js'), 'serve', '--file', file, '--port', String(port)], { stdio: 'ignore' });
  const url = `http://127.0.0.1:${port}/`;
  try {
    await waitForServer(url);
    const sse = (await fetch(url + 'sse')).body.getReader();
    await readUntil(sse, /event: roadmap/);
    Shots.add(dir, { task: 'T1', buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16, 2)]) });
    assert.match(await readUntil(sse, /event: shots/), /event: shots/);
    sse.cancel();
  } finally { child.kill(); }
});
