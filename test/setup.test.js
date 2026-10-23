const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const Setup = require('../lib/setup.js');

const CLI = path.join(__dirname, '../bin/visual-roadmap.js');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'visual-roadmap-setup-'));

test('detects the package manager from the lockfile', () => {
  const cases = [
    ['pnpm-lock.yaml', ['pnpm', 'add', '-D', 'visual-roadmap']],
    ['bun.lock', ['bun', 'add', '-d', 'visual-roadmap']],
    ['bun.lockb', ['bun', 'add', '-d', 'visual-roadmap']],
    ['yarn.lock', ['yarn', 'add', '-D', 'visual-roadmap']],
    ['package-lock.json', ['npm', 'install', '--save-dev', 'visual-roadmap']],
    [null, ['npm', 'install', '--save-dev', 'visual-roadmap']]
  ];
  for (const [lock, expected] of cases) {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'package.json'), '{}');
    if (lock) fs.writeFileSync(path.join(dir, lock), '');
    assert.deepEqual(Setup.installCommand(dir), expected, lock || 'no lockfile');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('installs only in a JS project that does not have it yet', () => {
  const dir = tmp();
  assert.equal(Setup.needsInstall(dir), false, 'no package.json: nothing to install into');
  fs.writeFileSync(path.join(dir, 'package.json'), '{"devDependencies":{}}');
  assert.equal(Setup.needsInstall(dir), true);
  fs.writeFileSync(path.join(dir, 'package.json'), '{"devDependencies":{"visual-roadmap":"^0.7.0"}}');
  assert.equal(Setup.needsInstall(dir), false, 'already declared');
  fs.writeFileSync(path.join(dir, 'package.json'), '{}');
  fs.mkdirSync(path.join(dir, 'node_modules', 'visual-roadmap'), { recursive: true });
  assert.equal(Setup.needsInstall(dir), false, 'already installed');
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"visual-roadmap"}');
  fs.rmSync(path.join(dir, 'node_modules'), { recursive: true });
  assert.equal(Setup.needsInstall(dir), false, 'this repository itself');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('hooks point at a pinned npx when the CLI runs from the npx cache', () => {
  const dir = tmp();
  assert.equal(Setup.selfCommand(dir, '/home/u/.npm/_npx/ab12/node_modules/visual-roadmap', '0.7.0'), 'npx -y visual-roadmap@0.7.0');
  assert.match(Setup.selfCommand(dir, '/repos/visual-roadmap', '0.7.0'), /^node ".*bin\/visual-roadmap\.js"$/);
  fs.mkdirSync(path.join(dir, 'node_modules', 'visual-roadmap', 'bin'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'node_modules', 'visual-roadmap', 'bin', 'visual-roadmap.js'), '');
  assert.equal(Setup.selfCommand(dir, '/home/u/.npm/_npx/ab12/node_modules/visual-roadmap', '0.7.0'), 'npx --no visual-roadmap');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('bare command prints help when an agent pipes it', () => {
  const r = spawnSync(process.execPath, [CLI], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Commands:/);
});

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
}

test('up initializes an empty project and serves it in one step', { timeout: 15000 }, async () => {
  const dir = tmp();
  const port = await freePort();
  const child = spawn(process.execPath, [CLI, 'up', '--no-install', '--no-open', '--port', String(port)], { cwd: dir, stdio: 'ignore' });
  const url = `http://127.0.0.1:${port}/`;
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) {
      try { up = (await fetch(url + 'ping')).ok; } catch { await new Promise(r => setTimeout(r, 100)); }
    }
    assert.ok(up, 'server started');
    assert.ok(fs.existsSync(path.join(dir, 'ROADMAP.md')));
    assert.ok(fs.existsSync(path.join(dir, 'AGENTS.md')));
    assert.match(fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8'), new RegExp(path.basename(dir)));
  } finally {
    child.kill();
    await new Promise(r => setTimeout(r, 200));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('up keeps an existing roadmap untouched', { timeout: 15000 }, async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), '# Mine\n');
  const port = await freePort();
  const child = spawn(process.execPath, [CLI, 'up', '--no-install', '--no-open', '--port', String(port)], { cwd: dir, stdio: 'ignore' });
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) {
      try { up = (await fetch(`http://127.0.0.1:${port}/ping`)).ok; } catch { await new Promise(r => setTimeout(r, 100)); }
    }
    assert.ok(up, 'server started');
    assert.equal(fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8'), '# Mine\n');
    assert.ok(!fs.existsSync(path.join(dir, 'AGENTS.md')), 'existing project: init not rerun');
  } finally {
    child.kill();
    await new Promise(r => setTimeout(r, 200));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
