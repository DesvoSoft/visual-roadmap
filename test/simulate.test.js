const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');

test('the demo agent session runs end to end through the CLI without roadmap errors', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'simulate.js'), '--fast', '--no-server'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /T007, T008 created/);
  assert.match(r.stdout, /4\/8 tasks/);
});
