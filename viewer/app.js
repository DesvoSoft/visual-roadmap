/* app.js — Main Controller for Visual Roadmap
   Orchestrates: Watcher → md.js → HUD Mission Control & Views
   Matches the Voidfront / RSI Progress Tracker style */

(function (global) {
  'use strict';

  /* ── State ───────────────────────────────────────────── */
  let _doc = null;
  let _view = 'timeline';  /* 'timeline' (SEGUIMIENTO) | 'board' (VERSIONES) | 'log' (NOTAS) */

  const $ = id => document.getElementById(id);
  const q = sel => document.querySelector(sel);
  const qa = sel => [...document.querySelectorAll(sel)];

  /* ── Update Header & HUD Mission Control ──────────────── */
  function updateHUD(doc) {
    if (!doc) return;
    const s = doc.stats || {};
    const n = doc.nowTask || {};

    /* Rail brand & crumbs */
    const brandName = doc.title || 'VOIDFRONT';
    if ($('rail-brand-name')) $('rail-brand-name').textContent = brandName;
    if ($('crumb-project')) $('crumb-project').textContent = brandName;

    /* Updated timestamp */
    if ($('header-updated') && doc.updated) {
      $('header-updated').textContent = `Actualizado ${doc.updated}`;
    }

    /* Metric Bar under Title */
    if ($('m-version')) $('m-version').textContent = doc.version || '0.1';
    if ($('m-phase')) $('m-phase').textContent = doc.phase || '11';
    if ($('m-phase-total')) $('m-phase-total').textContent = s.phasesTotal || '14';
    if ($('m-tasks-done')) $('m-tasks-done').textContent = s.done || '75';
    if ($('m-tasks-total')) $('m-tasks-total').textContent = s.total || '92';
    if ($('m-tests')) $('m-tests').textContent = doc.tests ? String(doc.tests) : '397';
    if ($('m-e2e')) $('m-e2e').textContent = doc.e2e ? String(doc.e2e) : '37';
    if ($('m-decisions')) $('m-decisions').textContent = doc.decisions ? String(doc.decisions) : '92';
    if ($('m-lines')) $('m-lines').textContent = doc.linesCount ? String(doc.linesCount).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '29.421';
    if ($('m-commit')) $('m-commit').textContent = doc.lastCommit || '335e3ea';
    if ($('m-commit-time')) $('m-commit-time').textContent = doc.lastCommitTime || 'hace 49 min';

    /* ── Card 1: AHORA MISMO · EN CURSO ── */
    if ($('now-id')) $('now-id').textContent = n.id || 'T109';
    if ($('now-name')) $('now-name').textContent = n.name || 'Props del mundo';
    if ($('now-context')) $('now-context').textContent = n.context || 'Fase 11 · Resto de assets · Arte procedural';
    if ($('now-expected')) $('now-expected').textContent = n.expected || '01:15';
    if ($('now-elapsed')) $('now-elapsed').textContent = n.elapsed || '49 min';
    if ($('now-warn')) $('now-warn').textContent = n.status || 'tarda más de lo previsto';

    if ($('now-fill')) {
      /* Calculate bar width */
      let pct = 65;
      if (n.expected && n.elapsed) {
        const expMins = parseMinutes(n.expected);
        const elapMins = parseMinutes(n.elapsed);
        if (expMins > 0) pct = Math.min(100, Math.round((elapMins / expMins) * 100));
      }
      $('now-fill').style.width = `${pct}%`;
    }

    /* ── Card 2: PROJECT & CADENCE ── */
    if ($('phase-title')) $('phase-title').textContent = `${brandName} ${doc.version || '0.1'}`;
    if ($('phase-pct')) $('phase-pct').textContent = `${s.pct || 82} %`;
    if ($('phase-tasks')) $('phase-tasks').textContent = `${s.done || 75} de ${s.total || 92} tareas`;
    if ($('phase-fill')) $('phase-fill').style.width = `${s.pct || 82}%`;

    if ($('phase-done-cnt')) $('phase-done-cnt').textContent = `${s.phasesDone || 10} de ${s.phasesTotal || 14}`;
    if ($('phase-eta')) $('phase-eta').textContent = s.estimatedText || '27 sept, 12:31';
    if ($('phase-pace')) $('phase-pace').textContent = s.cadenceText || '39,8 min por tarea';
    if ($('phase-started')) $('phase-started').textContent = s.startedText || '25 sept, 17:17';

    /* ── Card 3: ÚLTIMOS CAMBIOS ── */
    renderRecentChanges(doc);
  }

  function renderRecentChanges(doc) {
    const list = $('changes-list');
    if (!list) return;

    if (doc.recentChanges && doc.recentChanges.length > 0) {
      list.innerHTML = '';
      doc.recentChanges.slice(0, 7).forEach(c => {
        const row = document.createElement('div');
        row.className = 'change-row';

        const iconCls = c.icon === '✓' ? 'change-icon--ok' : 'change-icon--file';
        let diffHtml = '';
        if (c.diff) {
          const parts = c.diff.split(/\s+/);
          parts.forEach(p => {
            if (p.startsWith('+')) diffHtml += `<span class="diff-add">${p}</span> `;
            else if (p.startsWith('-')) diffHtml += `<span class="diff-sub">${p}</span> `;
          });
        }

        row.innerHTML = `
          <span class="change-time">${c.time || '12:00'}</span>
          <span class="change-icon ${iconCls}">${c.icon || '✓'}</span>
          <span class="change-text">${escapeHtml(c.text)}</span>
          <span class="change-diff">${diffHtml}</span>
        `;
        list.appendChild(row);
      });
    }
  }

  function parseMinutes(str) {
    if (!str) return 0;
    const m = /(\d+)\s*(?:m|min)/i.exec(str);
    if (m) return parseInt(m[1], 10);
    const hm = /(\d+):(\d+)/.exec(str);
    if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
    const h = /(\d+)\s*h/i.exec(str);
    if (h) return parseInt(h[1], 10) * 60;
    return 60;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ── View Navigation ──────────────────────────────────── */
  function setView(view) {
    _view = view;

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
          <p>Selecciona tu <strong>ROADMAP.md</strong> para comenzar la visualización</p>
          <button class="btn-pick" id="btn-pick-empty" style="margin-top: 10px; height: 32px; padding: 0 16px;">📂 Abrir ROADMAP.md</button>
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
      updateHUD(_doc);
      renderCurrentView();
    } catch (err) {
      console.error('[App] Error parsing ROADMAP.md', err);
    }
  });

  document.addEventListener('roadmap:file-open', e => {
    const name = e.detail && e.detail.name;
    if ($('file-name') && name) $('file-name').textContent = name;
  });

  /* ── Initialize ───────────────────────────────────────── */
  function init() {
    /* Rail Nav Buttons */
    qa('.rail__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.view) setView(btn.dataset.view);
      });
    });

    /* Open file button */
    const pickBtn = $('btn-pick');
    if (pickBtn) pickBtn.addEventListener('click', () => global.Watcher.pickFile());

    /* Setup drag & drop on the whole body */
    global.Watcher.setupDragDrop(document.body);
    global.Watcher.setupPaste();

    /* Try auto-loading local ROADMAP.md if served over http/https */
    if (location.protocol === 'http:' || location.protocol === 'https:') {
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
