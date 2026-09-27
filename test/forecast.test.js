const test = require('node:test');
const assert = require('node:assert/strict');
require('../viewer/md.js');
require('../viewer/forecast.js');

const source = `---
title: Demo
updated: 2026-09-26 10:00
capacity: 1
now_task:
  id: T001
  name: Primera tarea
  started_at: 2026-09-26 09:00
  expected: 01:00
---

## Releases
### Fase 1
| Item | Estado | Progreso | Esfuerzo | Real |
| --- | --- | --- | --- | --- |
| T001 Primera tarea | active | 20% | 1h | — |
| T002 Segunda tarea | planned | 0% | 2h | — |

## Estimaciones
- 2026-09-26 09:45 | T001 | 45m | Pruebas adicionales
`;

test('reads agent ETA revisions and keeps the initial estimate', () => {
  const doc = global.Roadmap.parse(source);
  const f = global.Forecast.calculate(doc, new Date('2026-09-26T10:00:00'));
  assert.equal(doc.stats.total, 2);
  assert.equal(f.elapsed, 60);
  assert.equal(f.initialMinutes, 60);
  assert.equal(f.eta, new Date('2026-09-26T10:30:00').getTime());
  assert.equal(f.latestChange.reason, 'Pruebas adicionales');
  assert.equal(f.provisional, false);
  assert.equal(f.projections.size, 2);
  assert.equal(f.projectRange.confidence, 'baja');
  assert.ok(f.projectRange.early < f.projectEta && f.projectEta < f.projectRange.late);
});

test('calibrates future effort with actual durations', () => {
  const withHistory = source.replace('| T002 Segunda tarea | planned | 0% | 2h | — |',
    '| T002 Segunda tarea | planned | 0% | 2h | — |\n| T003 Trabajo anterior | done | 100% | 1h | 2h |');
  const doc = global.Roadmap.parse(withHistory);
  const f = global.Forecast.calculate(doc, new Date('2026-09-26T10:00:00'));
  assert.equal(f.samples, 1);
  assert.equal(f.paceFactor, 2);
});

test('marks an elapsed estimate provisional until the agent revises it', () => {
  const doc = global.Roadmap.parse(source.replace(/## Estimaciones[\s\S]*/, ''));
  const f = global.Forecast.calculate(doc, new Date('2026-09-26T10:20:00'));
  assert.equal(f.overdue, true);
  assert.equal(f.delayMinutes, 20);
  assert.equal(f.provisional, true);
  assert.ok(f.eta > new Date('2026-09-26T10:20:00').getTime());
});

test('does not fabricate telemetry without a task or estimates', () => {
  const doc = global.Roadmap.parse('---\ntitle: Empty\n---\n\n## Releases\n');
  const f = global.Forecast.calculate(doc, new Date('2026-09-26T10:00:00'));
  assert.equal(f.active, null);
  assert.equal(f.eta, null);
  assert.equal(doc.stats.total, 0);
  assert.equal(doc.stats.estimatedText, '');
});

test('keeps semantic version labels and does not complete a release with open work', () => {
  const doc = global.Roadmap.parse(`---\ntitle: Pilot\n---\n\n## Releases\n### v0.1 · Base navegable\n**done** · Entregable parcial\n| Item | Estado | Progreso | Esfuerzo | Inicio | Fin |\n| --- | --- | --- | --- | --- | --- |\n| T001 Visor | done | 100% | 45m | 2026-09-26 | 2026-09-26 |\n| T002 Validar juego | planned | 0% | 3h | — | — |`);
  assert.equal(doc.releases[0].id, 'v0.1');
  assert.equal(doc.releases[0].name, 'Base navegable');
  assert.equal(doc.releases[0].status, 'active');
  assert.equal(doc.releases[0].categories.length, 1);
  assert.equal(doc.releases[0].categories[0].items.length, 2);
});
