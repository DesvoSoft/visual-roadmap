/* Browser and in-app notifications for meaningful roadmap changes. */
(function (global) {
  'use strict';
  const storageKey = 'visual-roadmap-notify';
  const delivered = new Set();
  let enabled = false;
  const t = key => global.UI.t(key);
  const available = () => 'Notification' in global && global.isSecureContext;

  function eventsForTransition(prev, doc) {
    if (!prev) return [];
    const before = new Map(prev.items.map(item => [item.taskId || item.id, item.status]));
    const events = [];
    for (const item of doc.items) {
      const prior = before.get(item.taskId || item.id);
      if (!prior || prior === item.status) continue;
      if (item.status === 'done' || item.status === 'blocked') events.push({ type: item.status, item });
    }
    if (doc.stats.total && doc.stats.done === doc.stats.total && prev.stats.done !== prev.stats.total) {
      events.push({ type: 'complete', title: doc.title });
    }
    return events;
  }

  function toast(title, body) {
    let host = document.getElementById('notification-toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'notification-toasts';
      host.className = 'notification-toasts';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    const card = document.createElement('div');
    card.className = 'notification-toast';
    const heading = document.createElement('strong'); heading.textContent = title;
    const detail = document.createElement('span'); detail.textContent = body || '';
    const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', t('close'));
    close.addEventListener('click', () => card.remove());
    card.append(heading, detail, close); host.appendChild(card);
    if (host.children.length > 3) host.firstChild.remove();
    setTimeout(() => card.remove(), 6000);
  }

  function paint() {
    const button = document.getElementById('notify-toggle');
    if (!button) return;
    const supported = available();
    if (!supported || global.Notification.permission !== 'granted') enabled = false;
    button.disabled = !supported;
    button.classList.toggle('notification-toggle--on', enabled);
    button.setAttribute('aria-pressed', String(enabled));
    const key = !supported ? 'notifyUnavailable' : global.Notification.permission === 'denied' ? 'notifyDenied' : enabled ? 'notifyOn' : 'notifyOff';
    button.title = t(key);
    button.setAttribute('aria-label', t(key));
  }

  function setEnabled(on) {
    enabled = on;
    try { localStorage.setItem(storageKey, on ? 'on' : 'off'); } catch {}
    paint();
  }

  async function toggle() {
    if (!available()) { toast(t('notifyUnavailable'), ''); return; }
    if (enabled) { setEnabled(false); toast(t('notifyDisabled'), ''); return; }
    if (global.Notification.permission === 'denied') { toast(t('notifyDenied'), ''); return; }
    if (global.Notification.permission === 'granted') {
      setEnabled(true); toast(t('notifyEnabled'), ''); return;
    }
    toast(t('notifyRequesting'), '');
    let waiting = true;
    const reminder = setTimeout(() => { if (waiting) toast(t('notifyPermissionPending'), ''); }, 8000);
    try {
      const permission = await global.Notification.requestPermission();
      setEnabled(permission === 'granted');
      toast(t(permission === 'granted' ? 'notifyEnabled' : 'notifyDenied'), '');
    } catch {
      toast(t('notifyDenied'), '');
    } finally {
      waiting = false;
      clearTimeout(reminder);
    }
  }

  function send(key, title, body) {
    if (!enabled || !available() || global.Notification.permission !== 'granted' || delivered.has(key)) return;
    if (!document.hidden && document.hasFocus()) {
      toast(title, body);
      delivered.add(key);
      return;
    }
    try {
      new global.Notification(title, { body, tag: key });
      delivered.add(key);
    } catch {
      toast(title, body);
      delivered.add(key);
    }
  }

  function transitions(prev, doc) {
    for (const event of eventsForTransition(prev, doc)) {
      if (event.type === 'complete') send(`complete:${doc.title}`, `✓ ${doc.title}`, t('allDone'));
      else {
        const item = event.item;
        const label = `${item.taskId ? item.taskId + ' · ' : ''}${item.name}`;
        send(`${event.type}:${label}`, `${event.type === 'done' ? '✓ ' + t('done') : '⚠ ' + t('blockedStatus')}: ${label}`, doc.title);
      }
    }
  }

  function init() {
    try { enabled = available() && localStorage.getItem(storageKey) === 'on' && global.Notification.permission === 'granted'; } catch {}
    document.getElementById('notify-toggle')?.addEventListener('click', toggle);
    document.addEventListener('roadmap:preferences', paint);
    document.addEventListener('visibilitychange', paint);
    paint();
  }

  global.RoadmapNotifications = { init, send, transitions, eventsForTransition };
})(typeof window !== 'undefined' ? window : globalThis);
