/* lib/githook.js — a git commit-msg hook that works with every agent, since all of
   them commit: it adds a Roadmap-Task trailer naming the active task when the message
   names none, and warns (never blocks) when code is committed with nothing active. */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MARKER = '# visual-roadmap: commit-msg';
const TASK_RE = /\bT\d{2,}[\w-]*/i;

function script(cmd) {
  return `#!/bin/sh\n${MARKER} — links commits to the active task. Never blocks a commit.\n${cmd} hook commit-msg "$1" || true\nexit 0\n`;
}

/** Hooks folder git uses here (honours core.hooksPath), or null outside a repository. */
function hooksDir(cwd) {
  try {
    const out = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return out ? path.resolve(cwd, out) : null;
  } catch { return null; }
}

/** Install or refresh the hook. Returns { status: 'installed'|'updated'|'current'|'foreign'|'managed'|'no-repo', file, line }. */
function install(cwd, cmd) {
  const dir = hooksDir(cwd);
  if (!dir) return { status: 'no-repo' };
  const file = path.join(dir, 'commit-msg');
  const line = `${cmd} hook commit-msg "$1" || true`;
  /* Husky and similar regenerate their hooks folder: the line belongs in their own commit-msg. */
  if (/[\\/]\.husky[\\/]/.test(dir + path.sep)) return { status: 'managed', file: path.join(cwd, '.husky', 'commit-msg'), line };
  const body = script(cmd);
  if (fs.existsSync(file)) {
    const current = fs.readFileSync(file, 'utf8');
    if (!current.includes(MARKER)) return { status: 'foreign', file, line };
    if (current === body) return { status: 'current', file };
    fs.writeFileSync(file, body);
    return { status: 'updated', file };
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, body);
  try { fs.chmodSync(file, 0o755); } catch {}
  return { status: 'installed', file };
}

/** Messages that should be left alone: merges, fixups, reverts, or ones already naming a task. */
function skip(message) {
  const subject = message.split('\n').find(l => l.trim() && !l.startsWith('#')) || '';
  return !subject || /^(Merge |fixup! |squash! |amend! |Revert ")/.test(subject) || TASK_RE.test(message.replace(/^#.*$/gm, ''));
}

/** Add the trailer to the message file; git places it correctly around comments and other trailers. */
function addTrailer(cwd, file, taskId) {
  try {
    execFileSync('git', ['interpret-trailers', '--in-place', '--if-exists', 'doNothing', '--trailer', `Roadmap-Task: ${taskId}`, file], { cwd, stdio: 'ignore' });
  } catch {
    fs.appendFileSync(file, `\nRoadmap-Task: ${taskId}\n`);
  }
}

module.exports = { install, script, skip, addTrailer, hooksDir, MARKER };
