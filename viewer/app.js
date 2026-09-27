/* app.js — Main Controller for Visual Roadmap
   Orchestrates: Watcher → md.js → HUD Mission Control & Views
   Derives live clocks and forecasts from agent updates. */

(function (global) {
  'use strict';

  /* ── State ───────────────────────────────────────────── */
  let _doc = null;
  let _view = 'timeline';  /* timeline | board | log */
  let _source = 'manual';

  const $ = id => document.getElementById(id);
  const q = sel => document.querySelector(sel);
  const qa = sel => [...document.querySelectorAll(sel)];
  const t = (key, vars) => global.UI.t(key, vars);

  /* ── Update Header & HUD Mission Control ──────────────── */
  function updateHUD(doc) {
    if (!doc) return;
    const s = doc.stats || {};
    const forecast = global.Forecast.calculate(doc);
    const n = forecast.active && String(doc.nowTask?.id || '').toUpperCase() === String(forecast.active.taskId || '').toUpperCase()
      ? doc.nowTask : {};

    /* Rail brand & crumbs */
    const brandName = doc.title || 'ROADMAP';
    if ($('rail-brand-name')) $('rail-brand-name').textContent = brandName;
    if ($('crumb-project')) $('crumb-project').textContent = brandName;

    /* Updated timestamp */
    if ($('header-updated')) $('header-updated').textContent = forecast.ageMinutes != null
      ? t('updatedAgo').replace('{time}', global.Forecast.duration(forecast.ageMinutes)) : t('unknownUpdate');

    /* Metric Bar under Title */
    const values = { 'm-version': doc.version, 'm-phase': doc.phase, 'm-phase-total': doc.phase ? s.phasesTotal : null, 'm-tasks-done': s.done, 'm-tasks-total': s.total, 'm-tests': doc.meta.tests, 'm-e2e': doc.meta.e2e, 'm-decisions': doc.meta.decisions, 'm-lines': doc.meta.lines, 'm-commit': doc.lastCommit, 'm-commit-time': doc.lastCommitTime };
    Object.entries(values).forEach(([id, value]) => { if ($(id)) $(id).textContent = value === '' || value == null ? '—' : value; });
    qa('.m-item').forEach(el => { el.hidden = [...el.querySelectorAll('[id]')].every(child => child.textContent === '—'); });

    /* ── Card 1: AHORA MISMO · EN CURSO ── */
    const active = forecast.active;
    if ($('now-id')) $('now-id').textContent = active?.taskId || n.id || '';
    if ($('now-name')) $('now-name').textContent = active?.name || t('noTask');
    if ($('now-context')) $('now-context').textContent = n.context || active?.release || t('markActive');
    if ($('now-expected')) $('now-expected').textContent = n.expected || (active?.effort ? `${active.effort} h` : '—');
    if ($('now-elapsed')) $('now-elapsed').textContent = global.Forecast.duration(forecast.elapsed);
    const moved = forecast.initialEta != null && forecast.eta != null
      ? Math.round((forecast.eta - forecast.initialEta) / 60000) : 0;
    if ($('now-warn')) $('now-warn').textContent = forecast.overdue
      ? `${t('delayed')}: ${global.Forecast.duration(forecast.delayMinutes)} · ${t('provisional')}`
      : forecast.latestChange && moved > 0 ? `${t('etaExtended')} ${global.Forecast.duration(moved)}` : n.status || '';
    if ($('now-eta')) $('now-eta').textContent = forecast.eta != null
      ? `${global.Forecast.dateTime(forecast.eta)}${forecast.provisional ? ' · ' + t('provisional') : ''}` : t('noEstimate');
    if ($('now-reason')) $('now-reason').textContent = forecast.latestChange?.reason || n.reason || '';
    if ($('now-forecast-label')) $('now-forecast-label').textContent = forecast.latestChange ? t('revisedEta') : t('agentEta');

    if ($('now-fill')) {
      /* Calculate bar width */
      const pct = active?.progress || 0;
      $('now-fill').style.width = `${pct}%`;
    }

    /* ── Card 2: PROJECT & CADENCE ── */
    if ($('phase-title')) $('phase-title').textContent = `${brandName} ${doc.version}`;
    if ($('phase-pct')) $('phase-pct').textContent = `${s.pct} %`;
    if ($('phase-tasks')) $('phase-tasks').textContent = `${s.done} ${t('of')} ${s.total} ${t('tasks')}`;
    if ($('phase-fill')) $('phase-fill').style.width = `${s.pct}%`;

    if ($('phase-done-cnt')) $('phase-done-cnt').textContent = `${s.phasesDone} ${t('of')} ${s.phasesTotal}`;
    if ($('phase-eta')) $('phase-eta').textContent = forecast.projectEta != null
      ? `${global.Forecast.dateTime(forecast.projectEta)} · ${t('calculated')}` : s.estimatedText || t('noEstimate');
    if ($('phase-pace')) $('phase-pace').textContent = s.cadenceText || (s.cadenceMinutes != null ? `${s.cadenceMinutes} min ${t('perTask')}` : t('noEstimate'));
    if ($('phase-started')) $('phase-started').textContent = global.Forecast.timestamp(doc.meta.started) != null
      ? global.Forecast.dateTime(global.Forecast.timestamp(doc.meta.started)) : s.startedText || t('noDate');
    const rangeText = forecast.projectRange
      ? `${t('range')}: ${global.Forecast.dateTime(forecast.projectRange.early)} – ${global.Forecast.dateTime(forecast.projectRange.late)} · ${t('confidence')} ${t(forecast.projectRange.confidence === 'baja' ? 'low' : forecast.projectRange.confidence === 'media' ? 'medium' : 'high')}. ` : '';
    if ($('forecast-note')) $('forecast-note').textContent = rangeText + (forecast.unknown
      ? `${forecast.unknown} ${t('missingEffort')}`
      : forecast.provisional ? t('reviewEta')
      : forecast.samples
        ? t('calibrated', {count:forecast.samples,capacity:forecast.capacity})
        : t('basedOnEffort'));
    const history = $('estimate-history');
    if (history) {
      history.replaceChildren();
      if (forecast.changes.length) forecast.changes.slice(-4).reverse().forEach(change => {
        const line = document.createElement('div');
        line.className = 'estimate-event';
        line.textContent = `${global.Forecast.dateTime(change.time)} · ${change.taskId}: ${change.remaining} ${t('remaining')}${change.reason ? ' · ' + change.reason : ''}`;
        history.appendChild(line);
      });
      else history.textContent = t('noRevisions');
    }

    /* ── Card 3: ÚLTIMOS CAMBIOS ── */
    renderRecentChanges(doc);
  }

  function renderRecentChanges(doc) {
    const list = $('changes-list');
    if (!list) return;

    list.innerHTML = '';
    if (doc.recentChanges && doc.recentChanges.length > 0) {
      doc.recentChanges.slice(0, 7).forEach(c => {
        const row = document.createElement('div');
        row.className = 'change-row';

        const iconCls = c.icon === '✓' ? 'change-icon--ok' : 'change-icon--file';
        let diffHtml = '';
        if (c.diff) {
          const parts = c.diff.split(/\s+/);
          parts.forEach(p => {
          if (/^\+\d+$/.test(p)) diffHtml += `<span class="diff-add">${p}</span> `;
            else if (/^-\d+$/.test(p)) diffHtml += `<span class="diff-sub">${p}</span> `;
          });
        }

        row.innerHTML = `
          <span class="change-time">${escapeHtml(c.time || '')}</span>
          <span class="change-icon ${iconCls}">${escapeHtml(c.icon || '')}</span>
          <span class="change-text">${escapeHtml(c.text)}</span>
          <span class="change-diff">${diffHtml}</span>
        `;
        list.appendChild(row);
      });
    } else {
      list.textContent = t('noChanges');
    }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ── View Navigation ──────────────────────────────────── */
  function setView(view) {
    _view = view;
    $('app').dataset.view = view;
    $('page-title').dataset.i18n = view === 'board' ? 'versionsTitle' : view === 'log' ? 'notes' : 'progress';
    global.UI.apply();

    qa('.rail__btn').forEach(btn => {
      btn.classList.toggle('rail__btn--active', btn.dataset.view === view);
    });

    renderCurrentView();
  }

  function renderCurrentView() {
    const main = $('main-view');
    if (!main) return;

    if (!_doc) {
      main.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📄</div>
          <p>${t('choose')}</p>
          <button class="btn-pick" id="btn-pick-empty" style="margin-top: 10px; height: 32px; padding: 0 16px;">${t('pick')}</button>
        </div>
      `;
      const emptyPick = $('btn-pick-empty');
      if (emptyPick) emptyPick.addEventListener('click', () => global.Watcher.pickFile());
      return;
    }

    main.innerHTML = '';

    if (_view === 'timeline') {
      if (global.Timeline) global.Timeline.render(_doc, main);
    } else if (_view === 'board') {
      if (global.Board) global.Board.render(_doc, main);
    } else if (_view === 'log') {
      if (global.Log) global.Log.render(_doc, main);
    }
  }

  /* ── Event Listeners ─────────────────────────────────── */
  document.addEventListener('roadmap:update', e => {
    const text = e.detail && e.detail.content;
    if (!text) return;
    try {
      _doc = global.Roadmap.parse(text);
      _source = e.detail.source || 'manual';
      $('app').classList.remove('awaiting-roadmap');
      $('app').classList.add('has-roadmap');
      const panel = q('.hud-panel');
      if (panel) {
        panel.classList.remove('hud-panel--updated');
        void panel.offsetWidth;
        panel.classList.add('hud-panel--updated');
      }
      updateHUD(_doc);
      renderCurrentView();
    } catch (err) {
      console.error('[App] Error parsing ROADMAP.md', err);
      const main = $('main-view');
      if (main) main.textContent = `No se pudo leer ROADMAP.md: ${err.message}`;
    }
  });

  document.addEventListener('roadmap:file-open', e => {
    const name = e.detail && e.detail.name;
    if ($('file-name') && name) $('file-name').textContent = name;
  });
  document.addEventListener('roadmap:connection', e => {
    const state = e.detail?.state || 'offline';
    const badge = $('live-indicator');
    if (badge) {
      badge.dataset.state = state;
      $('connection-text').textContent = state === 'live' ? t('connected') : state === 'connecting' ? t('connecting') : t('disconnected');
    }
  });
  document.addEventListener('roadmap:no-live', () => {
    const badge = $('live-indicator');
    if (badge) { badge.dataset.state = 'snapshot'; $('connection-text').textContent = t('snapshot'); }
  });
  document.addEventListener('roadmap:preferences', () => {
    $('page-title').dataset.i18n = _view === 'board' ? 'versionsTitle' : _view === 'log' ? 'notes' : 'progress';
    global.UI.apply();
    if (_doc) { updateHUD(_doc); renderCurrentView(); }
    else renderCurrentView();
    const badge = $('live-indicator');
    if (badge) $('connection-text').textContent = badge.dataset.state === 'live' ? t('connected') : badge.dataset.state === 'connecting' ? t('connecting') : badge.dataset.state === 'snapshot' ? t('snapshot') : t('disconnected');
  });

  /* ── Initialize ───────────────────────────────────────── */
  function init() {
    global.UI.apply();
    $('app').dataset.view = _view;
    if (!$('app').classList.contains('has-roadmap')) $('app').classList.add('awaiting-roadmap');
    /* Rail Nav Buttons */
    qa('.rail__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.view) setView(btn.dataset.view);
      });
    });

    /* Open file button */
    const pickBtn = $('btn-pick');
    if (pickBtn) pickBtn.addEventListener('click', () => global.Watcher.pickFile());
    $('language-select')?.addEventListener('change', e => global.UI.setLanguage(e.target.value));
    $('theme-toggle')?.addEventListener('click', () => global.UI.setTheme(global.UI.theme === 'dark' ? 'light' : 'dark'));

    /* Setup drag & drop on the whole body */
    global.Watcher.setupDragDrop(document.body);
    global.Watcher.setupPaste();
    setInterval(() => { if (_doc) updateHUD(_doc); global.Timeline?.tickNow(); }, 15000);

    /* Try auto-loading local ROADMAP.md if served over http/https */
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      if (location.pathname === '/' && location.hostname === '127.0.0.1') {
        global.Watcher.setupSSE('/sse');
        renderCurrentView();
        return;
      }
      fetch('../ROADMAP.md')
        .then(r => r.ok ? r.text() : Promise.reject())
        .then(text => global.Watcher.inject(text, 'ROADMAP.md'))
        .catch(() => {
          fetch('ROADMAP.md')
            .then(r => r.ok ? r.text() : Promise.reject())
            .then(text => global.Watcher.inject(text, 'ROADMAP.md'))
            .catch(() => renderCurrentView());
        });
    } else {
      renderCurrentView();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(typeof window !== 'undefined' ? window : globalThis);
