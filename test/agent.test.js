const test = require('node:test');
const assert = require('node:assert/strict');
const Agent = require('../lib/agent.js');

const base = `---
title: Demo
updated: 2026-09-26 09:00
---

## Releases

### v0.1 · Acceso

| Item | Estado | Progreso | Esfuerzo | Inicio | Fin | Depende |
| --- | --- | --- | --- | --- | --- | --- |
| T001 Login | planned | 0% | 40m | — | — | — |
| T002 Tests login | planned | 0% | — | — | — | T001 |

## Últimos cambios

- 08:00 | 📄 | Plan inicial
`;
const at = (hhmm) => new Date(`2026-09-26T${hhmm}:00`).getTime();
const parse = text => (require('../viewer/md.js'), globalThis.Roadmap.parse(text));

test('start marks the row active and writes now_task', () => {
  const { text } = Agent.start(base, 't001', {}, at('10:00'));
  const doc = parse(text);
  const item = doc.items[0];
  assert.equal(item.status, 'active');
  assert.equal(item.start, '2026-09-26 10:00');
  assert.equal(doc.nowTask.id, 'T001');
  assert.equal(doc.nowTask.expected, '40m');
  assert.equal(doc.nowTask.context, 'v0.1 · Acceso');
  assert.equal(doc.meta.updated, '2026-09-26 10:00');
  assert.equal(doc.recentChanges[0].icon, '▶');
  assert.deepEqual(Agent.check(text).filter(i => i.level !== 'info'), []);
});

test('done records end, actual duration and clears now_task', () => {
  const started = Agent.start(base, 'T001', {}, at('10:00')).text;
  const { text } = Agent.done(started, 'T001', { note: 'tests verdes' }, at('10:35'));
  const doc = parse(text);
  const item = doc.items[0];
  assert.equal(item.status, 'done');
  assert.equal(item.progress, 100);
  assert.equal(item.end, '2026-09-26 10:35');
  assert.equal(item.actual, 35 / 60);
  assert.equal(item.note, 'tests verdes');
  assert.equal(doc.nowTask, null);
  assert.match(text, /\| Real \| Nota \|/);
});

test('eta appends a revision the forecast uses', () => {
  const started = Agent.start(base, 'T001', {}, at('10:00')).text;
  const { text } = Agent.eta(started, 'T001', '30m', 'caso OAuth', at('10:20'));
  const doc = parse(text);
  assert.equal(doc.estimateChanges.length, 1);
  const f = globalThis.Forecast.calculate(doc, at('10:21'));
  assert.equal(f.eta, at('10:50'));
  assert.equal(f.latestChange.reason, 'caso OAuth');
});

test('block clears the current task and requires a reason', () => {
  assert.throws(() => Agent.block(base, 'T001', ''), /why/);
  const started = Agent.start(base, 'T002', { expected: '25m' }, at('10:00')).text;
  const { text } = Agent.block(started, 'T002', 'falta API key', at('10:05'));
  const doc = parse(text);
  assert.equal(doc.items[1].status, 'blocked');
  assert.equal(doc.nowTask, null);
});

test('unknown tasks fail loudly and CRLF files keep their line endings', () => {
  assert.throws(() => Agent.start(base, 'T999'), /not found/);
  const crlf = base.replace(/\n/g, '\r\n');
  const { text } = Agent.progress(crlf, 'T001', 50, at('10:00'));
  assert.ok(!/[^\r]\n/.test(text));
  assert.equal(parse(text).items[0].progress, 50);
});

test('status lists ready tasks whose dependencies are done', () => {
  let text = Agent.start(base, 'T001', {}, at('10:00')).text;
  assert.deepEqual(Agent.status(text, at('10:05')).next, []);
  text = Agent.done(text, 'T001', {}, at('10:30')).text;
  const s = Agent.status(text, at('10:31'));
  assert.equal(s.active, null);
  assert.equal(s.next[0].id, 'T002');
});

test('dependencies by task ID are resolved, not reported missing', () => {
  assert.ok(!Agent.check(base).some(i => i.code === 'missingDep'));
  const broken = base.replace('| — | — | T001 |', '| — | — | T404 |');
  assert.ok(Agent.check(broken).some(i => i.code === 'missingDep' && i.level === 'error'));
});

test('add assigns the next ID, creates releases and places rows after a task', () => {
  let r = Agent.add(base, 'Recuperar contraseña', { effort: '30m', after: 'T001', depends: 'T001' }, at('10:00'));
  assert.equal(r.id, 'T003');
  let doc = parse(r.text);
  assert.deepEqual(doc.items.map(i => i.taskId), ['T001', 'T003', 'T002']);
  assert.deepEqual(doc.items[1].depends, ['T001']);
  r = Agent.add(r.text, 'Panel de admin', { effort: '1h', release: 'v0.2 · Admin' }, at('10:01'));
  doc = parse(r.text);
  assert.equal(doc.releases.length, 2);
  assert.equal(doc.releases[1].id, 'v0.2');
  assert.equal(doc.releases[1].items[0].taskId, 'T004');
  assert.equal(doc.releases[1].items[0].effort, 1);
});

test('split cancels the original, chains parts and moves dependents', () => {
  const started = Agent.start(base, 'T001', {}, at('10:00')).text;
  const r = Agent.split(started, 'T001', ['Formulario:20m', 'Validación: 25m'], at('10:05'));
  assert.deepEqual(r.ids, ['T003', 'T004']);
  assert.equal(r.started, 'T003');
  const doc = parse(r.text);
  const byId = Object.fromEntries(doc.items.map(i => [i.taskId, i]));
  assert.equal(byId.T001.status, 'cancelled');
  assert.equal(byId.T003.status, 'active');
  assert.deepEqual(byId.T004.depends, ['T003']);
  assert.deepEqual(byId.T002.depends, ['T004']);
  assert.equal(doc.nowTask.id, 'T003');
  /* a later dependency on the split task is redirected too */
  const added = Agent.add(r.text, 'Deploy', { effort: '10m', depends: 'T001' }, at('10:06'));
  assert.deepEqual(parse(added.text).items.find(i => i.taskId === 'T005').depends, ['T004']);
});

test('done --next starts the next ready task and reports git lines', () => {
  const started = Agent.start(base, 'T001', {}, at('10:00')).text;
  const r = Agent.done(started, 'T001', { next: true, diffSince: () => ({ add: 12, del: 3 }) }, at('10:30'));
  assert.equal(r.next, 'T002');
  assert.equal(r.diff, '+12 -3');
  const doc = parse(r.text);
  assert.equal(doc.nowTask.id, 'T002');
  assert.equal(doc.items[1].status, 'active');
});

test('brief is a few plain lines an agent can act on', () => {
  const text = Agent.start(base, 'T001', {}, at('10:00')).text;
  const lines = Agent.brief(text, at('10:50')).split('\n');
  assert.ok(lines.length <= 4);
  assert.match(lines[1], /^now: T001 .*ETA PASSED/);
  assert.match(Agent.brief('---\ntitle: X\n---\n'), /No tasks yet/);
});
