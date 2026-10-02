const test = require('node:test');
const assert = require('node:assert/strict');
require('../viewer/timeline.js');

test('search matches task code and words without accents', () => {
  const item = { taskId: 'T109', name: 'Optimización de imágenes' };
  assert.equal(global.Timeline.matchesTask(item, 't109'), true);
  assert.equal(global.Timeline.matchesTask(item, 'optimizacion'), true);
  assert.equal(global.Timeline.matchesTask(item, 'audio'), false);
});

test('focusing a result centers its whole block in the visible window', () => {
  const range = global.Timeline.focusRange({ start: 100, end: 140 }, 100);
  assert.deepEqual(range, { start: 70, end: 170, span: 100 });
});

test('fit range includes historical and projected blocks with room at both edges', () => {
  const range = global.Timeline.fitRange([{ start: 100, end: 200 }, { start: 300, end: 400 }], 250);
  assert.ok(range.start < 100);
  assert.ok(range.end > 400);
  assert.equal(range.end - range.start, range.span);
});

test('tasks group by consecutive #### subgroup and keep file order', () => {
  const items = [
    { id: 1, category: 'Arte' }, { id: 2, category: 'Arte' },
    { id: 3, category: 'Red' }, { id: 4, category: '' }
  ];
  const groups = global.Timeline.groupItems(items);
  assert.deepEqual(groups.map(g => [g.name, g.items.map(i => i.id)]), [['Arte', [1, 2]], ['Red', [3]], ['', [4]]]);
});

test('a release without subgroups yields one unnamed group', () => {
  const groups = global.Timeline.groupItems([{ id: 1 }, { id: 2 }]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, '');
});

test('a cancelled task that never finished draws no bar', () => {
  const w = global.Timeline.windowForItem({ status: 'cancelled', start: '2026-10-02 08:54', effort: 0.75 }, null, Date.parse('2026-10-02T09:00'));
  assert.equal(w.start, null);
  assert.equal(w.end, null);
});
