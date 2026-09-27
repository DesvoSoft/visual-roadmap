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
    const overdueMinutes = overdue ? Math.floor((now - eta) / MINUTE) : 0;
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
    const capacity = Math.max(1, Math.round(+doc.capacity || 1));
    let totalRemaining = 0, unknown = 0;
    const projections = new Map();
    /* List scheduling: `capacity` parallel lanes; a task starts when a lane is
       free and every open dependency has a projected end. Row order breaks ties. */
    const lanes = new Array(capacity).fill(now);
    const pending = open.slice();
    if (active && activeRemaining != null) {
      totalRemaining += activeRemaining;
      projections.set(active.id, { start: start ?? now, end: eta });
      lanes[0] = Math.max(now, eta);
      pending.splice(pending.indexOf(active), 1);
    }
    const find = dep => global.Roadmap && global.Roadmap.findTask ? global.Roadmap.findTask(doc, dep) : null;
    const blockers = item => item.depends.map(find).filter(t => t && t !== item && pending.includes(t));
    while (pending.length) {
      let index = pending.findIndex(item => !blockers(item).length);
      if (index === -1) index = 0;                       /* dependency cycle: keep row order */
      const item = pending.splice(index, 1)[0];
      const effort = item.effort ? item.effort * 60 * paceFactor * (1 - (item.progress || 0) / 100) : cadence;
      if (effort == null) { unknown++; continue; }
      const duration = Math.max(0, effort);
      const ready = Math.max(now, ...item.depends.map(dep => projections.get(find(dep)?.id)?.end || now));
      let lane = 0;
      for (let i = 1; i < lanes.length; i++) if (Math.max(lanes[i], ready) < Math.max(lanes[lane], ready)) lane = i;
      const begin = Math.max(lanes[lane], ready);
      lanes[lane] = begin + duration * MINUTE;
      projections.set(item.id, { start: begin, end: lanes[lane] });
      totalRemaining += duration;
    }
    const finish = Math.max(now, ...[...projections.values()].map(p => p.end));
    const projectEta = unknown ? null : finish;
    const uncertainty = ratios.length >= 5 ? .15 : ratios.length >= 2 ? .25 : .4;
    const projectRange = projectEta == null ? null : {
      early: now + (finish - now) * (1 - uncertainty),
      late: now + (finish - now) * (1 + uncertainty),
      confidence: ratios.length >= 5 ? 'alta' : ratios.length >= 2 ? 'media' : 'baja'
    };
    return {
      active, elapsed, initialMinutes, initialEta, eta, activeRemaining,
      overdue, overdueMinutes, delayMinutes, provisional, latestChange: latest, changes,
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
