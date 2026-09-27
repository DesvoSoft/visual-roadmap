const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Shots = require('../lib/shots.js');

const PNG = n => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, n)]);
const WEBP = n => Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8, n)]);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vr-shots-'));
const T0 = Date.parse('2026-09-27T14:00:00Z');

test('add stores the image, writes the index and a self-ignoring folder', () => {
  const root = tmp();
  const r = Shots.add(root, { task: 't011', buffer: PNG(1), caption: 'grid', now: T0 });
  assert.equal(r.entry.task, 'T011');
  assert.equal(r.count, 1);
  assert.match(r.entry.file, /^T011\/\d{8}-\d{4}-[0-9a-f]{8}\.png$/);
  assert.ok(fs.existsSync(Shots.resolve(root, r.entry.file)));
  assert.equal(fs.readFileSync(path.join(root, '.roadmap/shots/.gitignore'), 'utf8'), '*\n');
  assert.equal(Shots.list(root, 'T011').length, 1);
});

test('rejects bad task ids, non images and files over 10 MB', () => {
  const root = tmp();
  assert.throws(() => Shots.add(root, { task: '../x', buffer: PNG(1) }), /task/i);
  assert.throws(() => Shots.add(root, { task: 'T1', buffer: Buffer.from('hello') }), /PNG, JPEG or WebP/);
  const big = Buffer.concat([PNG(1), Buffer.alloc(10 * 1024 * 1024)]);
  assert.throws(() => Shots.add(root, { task: 'T1', buffer: big }), /10 MB/);
});

test('same image in the same task is stored once', () => {
  const root = tmp();
  Shots.add(root, { task: 'T1', buffer: PNG(1), now: T0 });
  assert.deepEqual(Shots.add(root, { task: 'T1', buffer: PNG(1), now: T0 + 60000 }).skipped, 'duplicate');
  assert.equal(Shots.list(root).length, 1);
});

test('hook shots are throttled to one per task every 30 s; cli shots are not', () => {
  const root = tmp();
  Shots.add(root, { task: 'T1', buffer: PNG(1), source: 'hook:chrome', throttle: true, now: T0 });
  assert.equal(Shots.add(root, { task: 'T1', buffer: PNG(2), source: 'hook:chrome', throttle: true, now: T0 + 10000 }).skipped, 'throttled');
  assert.ok(Shots.add(root, { task: 'T1', buffer: PNG(3), source: 'cli', now: T0 + 10000 }).entry);
  assert.ok(Shots.add(root, { task: 'T1', buffer: PNG(4), source: 'hook:chrome', throttle: true, now: T0 + 40000 }).entry);
});

test('cover is the latest final shot, else the latest one', () => {
  const e = (id, at, kind = 'progress') => ({ id, at, kind });
  assert.equal(Shots.cover([e('a', '1'), e('b', '3'), e('c', '2', 'final')]).id, 'c');
  assert.equal(Shots.cover([e('a', '1'), e('b', '3')]).id, 'b');
  assert.equal(Shots.cover([]), null);
});

test('retention keeps first, cover and the 6 latest intermediates per task', () => {
  const root = tmp();
  for (let i = 0; i < 10; i++) Shots.add(root, { task: 'T1', buffer: PNG(i), now: T0 + i * 60000 });
  const kept = Shots.list(root, 'T1');
  assert.equal(kept.length, 8);
  assert.equal(kept[0].at, new Date(T0).toISOString());
  assert.equal(kept.at(-1).at, new Date(T0 + 9 * 60000).toISOString());
  assert.equal(fs.readdirSync(path.join(root, '.roadmap/shots/T1')).length, 8);
});

test('global cap prunes intermediates of the oldest done tasks first', () => {
  const root = tmp();
  for (const task of ['T1', 'T2']) for (let i = 0; i < 4; i++) Shots.add(root, { task, buffer: PNG(i + (task === 'T2' ? 10 : 0)), now: T0 + i * 60000 });
  const removed = Shots.prune(root, { maxMb: 0, doneTasks: ['T1', 'T2'] });
  assert.equal(removed.length, 4);
  assert.deepEqual(Shots.list(root).map(s => s.task).sort(), ['T1', 'T1', 'T2', 'T2']);
});

test('resolve rejects paths outside the shots folder', () => {
  const root = tmp();
  assert.equal(Shots.resolve(root, '../../ROADMAP.md'), null);
  assert.equal(Shots.resolve(root, ''), null);
  assert.ok(Shots.resolve(root, 'T1/a.png').endsWith(path.join('.roadmap', 'shots', 'T1', 'a.png')));
});

test('replace swaps in a smaller WebP and keeps the original id', () => {
  const root = tmp();
  const { entry } = Shots.add(root, { task: 'T1', buffer: PNG(1), now: T0 });
  const out = Shots.replace(root, entry.id, WEBP(1));
  assert.equal(out.compressed, true);
  assert.match(out.file, /\.webp$/);
  assert.ok(!fs.existsSync(Shots.resolve(root, entry.file)));
  assert.equal(Shots.add(root, { task: 'T1', buffer: PNG(1), now: T0 + 60000 }).skipped, 'duplicate');
  assert.throws(() => Shots.replace(root, entry.id, PNG(2)), /WebP/);
});

test('a corrupt index is backed up and a new one starts', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.roadmap/shots'), { recursive: true });
  fs.writeFileSync(path.join(root, '.roadmap/shots/index.json'), '{nope');
  assert.equal(Shots.readIndex(root).recovered, true);
  assert.ok(fs.existsSync(path.join(root, '.roadmap/shots/index.json.bak')));
  assert.ok(Shots.add(root, { task: 'T1', buffer: PNG(1) }).entry);
});

test('optionsFromRoadmap reads shots_max_mb and done tasks oldest first', () => {
  const doc = { meta: { shots_max_mb: '20' }, items: [
    { taskId: 'T2', status: 'done', end: '2026-09-27 15:00' },
    { taskId: 'T1', status: 'done', end: '2026-09-27 14:00' },
    { taskId: 'T3', status: 'active', end: '' }] };
  assert.deepEqual(Shots.optionsFromRoadmap(doc), { maxMb: 20, doneTasks: ['T1', 'T2'] });
  assert.equal(Shots.optionsFromRoadmap({ meta: {}, items: [] }).maxMb, 150);
});
