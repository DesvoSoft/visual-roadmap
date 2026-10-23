const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const GitHook = require('../lib/githook.js');
const Git = require('../lib/git.js');

const CLI = path.join(__dirname, '../bin/visual-roadmap.js');
const ROADMAP = `---
title: Demo
---

## Releases

### v0.1 · Demo

| Tarea | Estado | Progreso | Esfuerzo | Inicio | Fin | Depende | Real | Nota |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T001 First | planned | 0% | 1h | — | — | — | — | — |
`;

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-roadmap-hook-'));
  const git = (...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), ROADMAP);
  const cli = (...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: dir, encoding: 'utf8' });
  const commit = (file, message) => {
    fs.writeFileSync(path.join(dir, file), file + '\n');
    git('add', '.');
    return git('commit', '-q', '-m', message);
  };
  return { dir, git, cli, commit };
}

test('leaves merges, fixups and messages that already name a task alone', () => {
  assert.equal(GitHook.skip('Merge branch main\n'), true);
  assert.equal(GitHook.skip('fixup! add search\n'), true);
  assert.equal(GitHook.skip('T004: add search\n'), true);
  assert.equal(GitHook.skip('Add search\n\n# T009 in a comment does not count\n'), false);
  assert.equal(GitHook.skip('Add search\n'), false);
});

test('commit-msg hook links commits to the active task and never blocks', { timeout: 30000 }, () => {
  const { dir, cli, commit } = repo();
  try {
    assert.match(cli('githook', '--install').stdout, /commit-msg/);
    const hook = fs.readFileSync(path.join(dir, '.git', 'hooks', 'commit-msg'), 'utf8');
    assert.ok(hook.includes(GitHook.MARKER));

    const none = commit('a.txt', 'Add a');
    assert.equal(none.status, 0, 'no active task: the commit still goes through');
    assert.match(none.stderr, /no active task/);

    cli('start', 'T001');
    assert.equal(commit('b.txt', 'Add b').status, 0);
    assert.equal(commit('c.txt', 'T001: add c').status, 0);
    const commits = Git.recentCommits(dir);
    assert.deepEqual(commits.map(c => c.tasks), [['T001'], ['T001'], []]);
    const body = execFileSync('git', ['log', '-1', '--skip=1', '--format=%B'], { cwd: dir, encoding: 'utf8' });
    assert.match(body, /^Roadmap-Task: T001$/m);

    assert.equal(GitHook.install(dir, 'x').status, 'updated', 'refreshes its own hook');
    fs.writeFileSync(path.join(dir, '.git', 'hooks', 'commit-msg'), '#!/bin/sh\necho mine\n');
    assert.equal(GitHook.install(dir, 'x').status, 'foreign', 'never overwrites a hook it did not write');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('outside a repository there is nothing to install', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-roadmap-nogit-'));
  assert.equal(GitHook.install(dir, 'x').status, 'no-repo');
  fs.rmSync(dir, { recursive: true, force: true });
});
