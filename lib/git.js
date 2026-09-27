/* lib/git.js — read-only git facts for the roadmap.
   Commits that mention a task ID (T004) are linked to that task; `done` uses
   the lines changed since the task started. Every call fails soft: no git,
   no repo or a shallow clone simply return empty results. */

'use strict';

const { execFileSync } = require('child_process');

const TASK_RE = /\bT\d{2,}[\w-]*/gi;

function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 });
  } catch { return null; }
}

function shortstat(text) {
  const add = /(\d+) insertions?/.exec(text || '');
  const del = /(\d+) deletions?/.exec(text || '');
  return { add: add ? +add[1] : 0, del: del ? +del[1] : 0 };
}

/** Last `limit` commits with their stats and the task IDs they mention. */
function recentCommits(cwd, limit = 40) {
  const out = git(cwd, ['log', `-${limit}`, '--no-merges', '--shortstat', '--format=%x1e%h%x1f%ct%x1f%s']);
  if (!out) return [];
  return out.split('\x1e').filter(Boolean).map(block => {
    const [head, ...rest] = block.split('\n');
    const [hash, time, subject] = head.split('\x1f');
    const tasks = [...new Set((subject.match(TASK_RE) || []).map(id => id.toUpperCase()))];
    return { hash, time: +time * 1000, subject, tasks, ...shortstat(rest.join('\n')) };
  });
}

/** Lines changed since `sinceMs`: commits after that time plus uncommitted work. */
const NOT_ROADMAP = ['--', '.', ':(exclude,icase)ROADMAP.md', ':(exclude,glob)**/ROADMAP.md'];

function changesSince(cwd, sinceMs) {
  const total = { add: 0, del: 0, commits: 0 };
  if (sinceMs != null) {
    const log = git(cwd, ['log', `--since=${Math.floor((sinceMs - 60000) / 1000)}`, '--no-merges', '--shortstat', '--format=%x1e', ...NOT_ROADMAP]) || '';
    for (const block of log.split('\x1e').filter(b => b.trim())) {
      const s = shortstat(block);
      total.add += s.add; total.del += s.del; total.commits++;
    }
  }
  const pending = shortstat(git(cwd, ['diff', 'HEAD', '--shortstat', ...NOT_ROADMAP]));
  total.add += pending.add; total.del += pending.del;
  return total;
}

module.exports = { recentCommits, changesSince };
