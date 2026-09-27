/* Time estimates are derived locally; agents only write changes at milestones. */
(function (global) {
  'use strict';
  const MINUTE = 60000;
  function minutes(raw) {
    if (typeof raw === 'number') return raw > 0 ? raw : null;
    const s = String(raw || '').trim().toLowerCase().replace(',', '.');
    if (!s) return null;
    const clock = /^(\d{1,3}):(\d{2})$/.exec(s);
    if (clock) return +clock[1] * 60 + +clock[2];
    const unit = /^(\d+(?:\.\d+)?)\s*(m|min|minutes?|h|hr|hours?|d|days?)$/.exec(s);
    if (!unit) return null;
    return +unit[1] * (/^d/.test(unit[2]) ? 480 : /^h/.test(unit[2]) ? 60 : 1);
  }
  function timestamp(raw) {
    if (!raw) return null;
    const value = new Date(String(raw).trim().replace(' ', 'T')).getTime();
    return Number.isFinite(value) ? value : null;
  }
  function taskId(item) { return String(item?.taskId || '').toUpperCase(); }
  function calculate(doc, clock) {
    const now = clock instanceof Date ? clock.getTime() : typeof clock === 'number' ? clock : Date.now();
    const items = doc.items || [];
    const active = items.find(it => it.status === 'active' && taskId(it) === String(doc.nowTask?.id || '').toUpperCase())
      || items.find(it => it.status === 'active') || null;
    const n = active && String(doc.nowTask?.id || '').toUpperCase() === taskId(active) ? doc.nowTask : {};
    const legacyElapsed = minutes(n.elapsed);
    const start = timestamp(n.startedAt) ?? (legacyElapsed != null && timestamp(doc.meta?.updated) != null
      ? timestamp(doc.meta.updated) - legacyElapsed * MINUTE : null);
    const initialMinutes = minutes(n.expected) || (active?.effort ? active.effort * 60 : null);
    const elapsed = start != null ? Math.max(0, Math.floor((now - start) / MINUTE)) : minutes(n.elapsed);
    const changes = (doc.estimateChanges || [])
      .filter(e => taskId(active) && e.taskId.toUpperCase() === taskId(active))
      .map(e => ({ ...e, time: timestamp(e.at), remainingMinutes: minutes(e.remaining) }))
      .filter(e => e.time != null && e.time <= now && e.remainingMinutes != null)
      .sort((a, b) => a.time - b.time);
    const latest = changes.at(-1) || null;
    const explicitRemaining = minutes(n.remaining);
    const remainingAt = timestamp(doc.meta?.updated) ?? now;
    const initialEta = start != null && initialMinutes != null ? start + initialMinutes * MINUTE : null;
    let eta = latest ? latest.time + latest.remainingMinutes * MINUTE :
      explicitRemaining != null ? remainingAt + explicitRemaining * MINUTE : initialEta;
    const overdue = eta != null && now > eta && active != null;
    const delayMinutes = initialMinutes != null && elapsed != null ? Math.max(0, elapsed - initialMinutes) : 0;
    let provisional = false;
    if (overdue) {
      const extension = Math.max(15, Math.ceil((initialMinutes || 60) * .25));
      eta = now + extension * MINUTE;
      provisional = true;
    }
    const activeRemaining = active && eta != null ? Math.max(0, Math.ceil((eta - now) / MINUTE)) : null;
    const cadence = minutes(doc.meta?.cadence);
    const ratios = items.filter(it => it.status === 'done' && it.effort > 0 && it.actual > 0)
      .map(it => it.actual / it.effort).sort((a, b) => a - b);
    const paceFactor = ratios.length ? Math.max(.5, Math.min(2, ratios[Math.floor(ratios.length / 2)])) : 1;
    const open = items.filter(it => it.status !== 'done' && it.status !== 'cancelled');
    let totalRemaining = 0, unknown = 0;
    const projections = new Map();
    let cursor = now;
    for (const item of open) {
      if (active && item === active && activeRemaining != null) {
        totalRemaining += activeRemaining;
        projections.set(item.id, { start: start ?? now, end: eta });
        cursor = Math.max(cursor, eta);
        continue;
      }
      const effort = item.effort ? item.effort * 60 * paceFactor * (1 - (item.progress || 0) / 100) : cadence;
      if (effort == null) unknown++;
      else {
        const duration = Math.max(0, effort);
        totalRemaining += duration;
        projections.set(item.id, { start: cursor, end: cursor + duration * MINUTE });
        cursor += duration * MINUTE;
      }
    }
    const capacity = Math.max(1, +doc.capacity || 1);
    const projectEta = unknown ? null : now + totalRemaining / capacity * MINUTE;
    const uncertainty = ratios.length >= 5 ? .15 : ratios.length >= 2 ? .25 : .4;
    const projectRange = projectEta == null ? null : {
      early: now + totalRemaining * (1 - uncertainty) / capacity * MINUTE,
      late: now + totalRemaining * (1 + uncertainty) / capacity * MINUTE,
      confidence: ratios.length >= 5 ? 'alta' : ratios.length >= 2 ? 'media' : 'baja'
    };
    return {
      active, elapsed, initialMinutes, initialEta, eta, activeRemaining,
      overdue, delayMinutes, provisional, latestChange: latest, changes,
      projectEta, projectRange, unknown, totalRemaining, capacity, paceFactor, samples: ratios.length, projections,
      ageMinutes: timestamp(doc.meta?.updated) != null ? Math.max(0, Math.floor((now - timestamp(doc.meta.updated)) / MINUTE)) : null
    };
  }
  function duration(value) {
    if (value == null) return '—';
    const m = Math.max(0, Math.round(value));
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
  }
  function dateTime(value) {
    if (value == null) return '—';
    return new Intl.DateTimeFormat(global.UI?.language || 'en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  }
  global.Forecast = { calculate, minutes, timestamp, duration, dateTime };
})(typeof window !== 'undefined' ? window : globalThis);
