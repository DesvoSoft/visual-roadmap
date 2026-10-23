/* lib/activity.js — what is observed in the working tree, as opposed to what the
   roadmap declares. Read by the live server (SSE `activity`) and by the agent's
   brief. Paths and times only: file contents are never read. Fails soft without git. */

'use strict';

const fs  = require('fs');
const Git = require('./git.js');

/** { lastWrite, roadmapAt, touched, paths, head }: touched = files written after the roadmap's last change. */
function snapshot(root, roadmapFile) {
  const files = Git.uncommitted(root);
  let roadmapAt = null;
  try { roadmapAt = fs.statSync(roadmapFile).mtimeMs; } catch {}
  const lastWrite = files.reduce((max, f) => Math.max(max, f.mtime), 0) || null;
  const touched = files.filter(f => roadmapAt == null || f.mtime > roadmapAt).sort((a, b) => b.mtime - a.mtime);
  return { lastWrite, roadmapAt, touched: touched.length, paths: touched.slice(0, 20).map(f => f.path), head: Git.head(root) };
}

/** Two snapshots differ in a way the viewer would show. */
function changed(a, b) {
  return !a || !b || a.lastWrite !== b.lastWrite || a.roadmapAt !== b.roadmapAt || a.touched !== b.touched || a.head?.hash !== b.head?.hash;
}

module.exports = { snapshot, changed };
