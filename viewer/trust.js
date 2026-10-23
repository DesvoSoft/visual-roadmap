/* trust.js — how far the roadmap can be believed.
   The roadmap is what the agent *declares*; the working tree and git are what is
   *observed*. Comparing both tells the viewer (and the agent's brief) when the
   declared state has drifted, without the agent spending a token on it.
   Produces window.Trust = { freshness, coverage, lastSignal }. */
(function (global) {
  'use strict';
  const MINUTE = 60000;
  const QUIET = 10;       /* minutes without any signal before an active task looks quiet */
  const STALE = 30;       /* … and before it looks abandoned */
  const UNTRACKED = 30;   /* writes this recent with nothing active mean work outside the roadmap */
  const AFTER_DONE = 10;  /* commits this long after `done` still belong to the task */

  const ts = raw => global.Forecast.timestamp(raw);
  const id = item => String(item?.taskId || '').toUpperCase();

  /** Most recent observed or declared sign of life, in ms. */
  function lastSignal(activity, commits = []) {
    const times = [activity?.lastWrite, activity?.roadmapAt, activity?.head?.time, commits[0]?.time].filter(t => t > 0);
    return times.length ? Math.max(...times) : null;
  }

  /** live | quiet | stale | paused (active task) · untracked | idle (none); null without observations. */
  function freshness(doc, forecast, activity, commits = [], now = Date.now()) {
    if (!activity) return null;
    const last = lastSignal(activity, commits);
    const minutes = last != null ? Math.max(0, Math.floor((now - last) / MINUTE)) : null;
    const active = forecast?.active;
    let state;
    if (active?.status === 'paused') state = 'paused';
    else if (active) state = minutes == null || minutes >= STALE ? 'stale' : minutes >= QUIET ? 'quiet' : 'live';
    else state = activity.touched > 0 && activity.lastWrite && now - activity.lastWrite < UNTRACKED * MINUTE ? 'untracked' : 'idle';
    return { state, minutes, touched: activity.touched || 0, task: active ? id(active) : null };
  }

  /** Share of commits since the roadmap started that name a task or fall inside one's work window. */
  function coverage(doc, commits = [], now = Date.now()) {
    const items = doc?.items || [];
    const ids = new Set(items.map(id).filter(Boolean));
    const windows = items.map(it => {
      const start = ts(it.start);
      if (start == null) return null;
      if (it.status === 'active' || it.status === 'paused') return [start, now];
      const end = ts(it.end);
      return it.status === 'done' && end != null ? [start, end + AFTER_DONE * MINUTE] : null;
    }).filter(Boolean);
    const started = ts(doc?.meta?.started);
    const relevant = commits.filter(c => started == null || c.time >= started - MINUTE);
    if (!relevant.length) return null;
    const covered = relevant.filter(c => (c.tasks || []).some(t => ids.has(t)) ||
      windows.some(([a, b]) => c.time >= a - MINUTE && c.time <= b)).length;
    return { covered, total: relevant.length, pct: Math.round(covered / relevant.length * 100) };
  }

  global.Trust = { freshness, coverage, lastSignal, QUIET, STALE };
})(typeof window !== 'undefined' ? window : globalThis);
