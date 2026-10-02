const test = require('node:test');
const assert = require('node:assert/strict');
require('../viewer/notifications.js');

test('only changed task states produce notification events', () => {
  const prev = { items: [
    { id: '1', taskId: 'T001', name: 'Listo', status: 'active' },
    { id: '2', taskId: 'T002', name: 'Atascado', status: 'planned' }
  ], stats: { total: 2, done: 0 } };
  const next = { title: 'Demo', items: [
    { id: '1', taskId: 'T001', name: 'Listo', status: 'done' },
    { id: '2', taskId: 'T002', name: 'Atascado', status: 'blocked' }
  ], stats: { total: 2, done: 1 } };
  assert.deepEqual(global.RoadmapNotifications.eventsForTransition(prev, next).map(e => e.type), ['done', 'blocked']);
  assert.deepEqual(global.RoadmapNotifications.eventsForTransition(next, next), []);
});

test('project completion produces a single completion event', () => {
  const item = { id: '1', taskId: 'T001', name: 'Listo', status: 'done' };
  const prev = { items: [item], stats: { total: 1, done: 0 } };
  const next = { title: 'Demo', items: [item], stats: { total: 1, done: 1 } };
  assert.deepEqual(global.RoadmapNotifications.eventsForTransition(prev, next).map(e => e.type), ['complete']);
});

test('sends one browser notification for a background event after permission is granted', () => {
  const sent = [];
  const original = { Notification: global.Notification, isSecureContext: global.isSecureContext, document: global.document, localStorage: global.localStorage };
  global.Notification = class { static permission = 'granted'; constructor(title, options) { sent.push({ title, options }); } };
  global.isSecureContext = true;
  global.localStorage = { getItem: () => 'on' };
  global.document = { getElementById: () => null, addEventListener: () => {}, hidden: true, hasFocus: () => false };
  try {
    global.RoadmapNotifications.init();
    global.RoadmapNotifications.send('test:unique', 'Ready', 'Task complete');
    global.RoadmapNotifications.send('test:unique', 'Ready', 'Task complete');
    assert.deepEqual(sent, [{ title: 'Ready', options: { body: 'Task complete', tag: 'test:unique' } }]);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete global[key]; else global[key] = value;
    }
  }
});
