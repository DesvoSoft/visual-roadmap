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

test('serves the viewer and streams roadmap changes', { timeout: 12000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-roadmap-'));
  const file = path.join(dir, 'ROADMAP.md');
  fs.writeFileSync(file, '# Initial\n');
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(__dirname, '../cli.js'), 'serve', '--file', file, '--port', String(port)], { stdio: 'ignore' });
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
  const run = input => spawnSync(process.execPath, [path.join(__dirname, '../cli.js'), 'hook', 'stop'], { cwd: dir, input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  try {
    const first = run({ stop_hook_active: false });
    assert.equal(first.status, 2);
    assert.match(first.stderr, /T404/);
    assert.equal(run({ stop_hook_active: true }).status, 0);
    const brief = spawnSync(process.execPath, [path.join(__dirname, '../cli.js'), 'hook', 'session-start'], { cwd: dir, input: '{}', encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
    assert.match(brief.stdout, /^\[visual-roadmap\] H · 0\/1 tasks/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
