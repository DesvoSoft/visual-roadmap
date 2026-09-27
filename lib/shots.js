/* lib/shots.js — screenshots attached to tasks.
   Stores images under .roadmap/shots/<TASK>/ next to ROADMAP.md with an
   index.json. The folder ignores itself in git. Pure fs; no dependencies. */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join('.roadmap', 'shots');
const MAX_BYTES = 10 * 1024 * 1024;
const KEEP_MIDDLE = 6;
const THROTTLE_MS = 30000;
const DEFAULT_MAX_MB = 150;
const EXT = { png: 'png', jpeg: 'jpg', webp: 'webp' };

const folder = root => path.join(root, DIR);
const byTime = (a, b) => a.at.localeCompare(b.at);

function sniff(buf) {
  if (!Buffer.isBuffer(buf)) return null;
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function ensure(root) {
  const dir = folder(root);
  fs.mkdirSync(dir, { recursive: true });
  const ignore = path.join(dir, '.gitignore');
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '*\n');
  return dir;
}

function readIndex(root) {
  const file = path.join(folder(root), 'index.json');
  if (!fs.existsSync(file)) return { version: 1, shots: [] };
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(data.shots)) return { version: 1, shots: data.shots };
  } catch {}
  fs.renameSync(file, file + '.bak');
  return { version: 1, shots: [], recovered: true };
}

function writeIndex(root, index) {
  const file = path.join(ensure(root), 'index.json');
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, shots: index.shots }, null, 2));
  fs.renameSync(tmp, file);
}

function resolve(root, rel) {
  const base = path.resolve(folder(root));
  const full = path.resolve(base, String(rel || ''));
  return full.startsWith(base + path.sep) ? full : null;
}

function stamp(ms) {
  const d = new Date(ms), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function cover(entries) {
  const finals = entries.filter(s => s.kind === 'final');
  const pool = finals.length ? finals : entries;
  return pool.reduce((best, s) => (!best || s.at >= best.at ? s : best), null);
}

function keepers(own) {
  if (!own.length) return new Set();
  return new Set([[...own].sort(byTime)[0].id, cover(own).id]);
}

function pruneIndex(root, index, { maxMb = DEFAULT_MAX_MB, doneTasks = [] } = {}) {
  const removed = [];
  const drop = s => {
    index.shots = index.shots.filter(x => x !== s);
    removed.push(s.file);
    const p = resolve(root, s.file);
    if (p) fs.rmSync(p, { force: true });
  };
  index.shots = index.shots.filter(s => { const p = resolve(root, s.file); return p && fs.existsSync(p); });
  for (const task of new Set(index.shots.map(s => s.task))) {
    const own = index.shots.filter(s => s.task === task).sort(byTime);
    const keep = keepers(own);
    const middle = own.filter(s => !keep.has(s.id));
    middle.slice(0, Math.max(0, middle.length - KEEP_MIDDLE)).forEach(drop);
  }
  const limit = maxMb * 1024 * 1024;
  let total = index.shots.reduce((n, s) => n + (s.bytes || 0), 0);
  for (const task of doneTasks.map(t => String(t).toUpperCase())) {
    if (total <= limit) break;
    const own = index.shots.filter(s => s.task === task).sort(byTime);
    const keep = keepers(own);
    for (const s of own) {
      if (total <= limit) break;
      if (keep.has(s.id)) continue;
      total -= s.bytes || 0;
      drop(s);
    }
  }
  return removed;
}

function add(root, { task, buffer, file, caption = '', kind = 'progress', source = 'cli', now = Date.now(), throttle = false, maxMb, doneTasks } = {}) {
  if (!/^[A-Za-z]+\d+$/.test(String(task || ''))) throw new Error(`Invalid task id: ${task}`);
  task = task.toUpperCase();
  const buf = buffer || fs.readFileSync(file);
  if (buf.length > MAX_BYTES) throw new Error('Image larger than 10 MB');
  const type = sniff(buf);
  if (!type) throw new Error('Not a PNG, JPEG or WebP image');
  const id = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
  const index = readIndex(root);
  const own = index.shots.filter(s => s.task === task);
  if (own.some(s => s.id === id)) return { skipped: 'duplicate', id };
  if (throttle && own.some(s => String(s.source).startsWith('hook') && now - Date.parse(s.at) < THROTTLE_MS)) return { skipped: 'throttled' };
  ensure(root);
  const rel = `${task}/${stamp(now)}-${id}.${EXT[type]}`;
  fs.mkdirSync(path.join(folder(root), task), { recursive: true });
  fs.writeFileSync(resolve(root, rel), buf);
  const entry = { id, task, at: new Date(now).toISOString(), file: rel, caption: String(caption).slice(0, 200),
    kind: kind === 'final' ? 'final' : 'progress', source, bytes: buf.length, compressed: type === 'webp' };
  index.shots.push(entry);
  const removed = pruneIndex(root, index, { maxMb, doneTasks });
  writeIndex(root, index);
  return { entry, count: index.shots.filter(s => s.task === task).length, removed };
}

function list(root, task) {
  return readIndex(root).shots
    .filter(s => !task || s.task === String(task).toUpperCase())
    .filter(s => { const p = resolve(root, s.file); return p && fs.existsSync(p); })
    .sort(byTime);
}

function prune(root, opts) {
  const index = readIndex(root);
  const removed = pruneIndex(root, index, opts);
  writeIndex(root, index);
  return removed;
}

function replace(root, id, buffer) {
  if (sniff(buffer) !== 'webp') throw new Error('Expected a WebP image');
  if (buffer.length > MAX_BYTES) throw new Error('Image larger than 10 MB');
  const index = readIndex(root);
  const s = index.shots.find(x => x.id === id);
  if (!s) return null;
  if (!s.compressed && buffer.length < s.bytes) {
    const rel = s.file.replace(/\.(png|jpg)$/, '.webp');
    fs.writeFileSync(resolve(root, rel), buffer);
    if (rel !== s.file) fs.rmSync(resolve(root, s.file), { force: true });
    Object.assign(s, { file: rel, bytes: buffer.length });
  }
  s.compressed = true;
  writeIndex(root, index);
  return s;
}

function optionsFromRoadmap(doc) {
  const maxMb = Number(doc?.meta?.shots_max_mb) > 0 ? Number(doc.meta.shots_max_mb) : DEFAULT_MAX_MB;
  const doneTasks = (doc?.items || [])
    .filter(it => it.status === 'done' && it.taskId)
    .sort((a, b) => String(a.end || '').localeCompare(String(b.end || '')))
    .map(it => it.taskId.toUpperCase());
  return { maxMb, doneTasks };
}

module.exports = { sniff, add, list, cover, prune, replace, resolve, readIndex, optionsFromRoadmap };
