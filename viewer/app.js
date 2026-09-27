/* app.js — Main controller
   Orquesta: Watcher → md.js → vistas + AI status panel + Issues */

(function (global) {
  'use strict';

  /* ── State ───────────────────────────────────────────── */

  let _doc = null;
  let _view = 'board';  /* 'board' | 'timeline' | 'log' | 'issues' */
  let _noLive = false;

  /* ── DOM refs ─────────────────────────────────────────── */

  const $ = id => document.getElementById(id);

  function q(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qa(sel, ctx) { return [...(ctx || document).querySelectorAll(sel)]; }

  /* ── Toast ────────────────────────────────────────────── */

  function toast(msg, type = 'info', ms = 3000) {
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast--show'));
    setTimeout(() => {
      t.classList.remove('toast--show');
      setTimeout(() => t.remove(), 400);
    }, ms);
  }

  /* ── AI Status Panel ──────────────────────────────────── */

  function updateAIStatus(doc) {
    const panel = $('ai-status');
    if (!panel) return;

    const meta = (doc && doc.meta) || {};
    const agent   = meta.ai_agent   || meta['ai-agent']   || null;
    const task    = meta.ai_task    || meta['ai-task']    || null;
    const item    = meta.ai_item    || meta['ai-item']    || null;
    const since   = meta.ai_since   || meta['ai-since']   || null;
    const eta     = meta.ai_eta     || meta['ai-eta']     || null;
    const phase   = meta.ai_phase   || meta['ai-phase']   || null;

    if (!agent && !task) {
      panel.classList.add('ai-status--hidden');
      return;
    }

    panel.classList.remove('ai-status--hidden');

    const agentEl = panel.querySelector('.ai-status__agent');
    const taskEl  = panel.querySelector('.ai-status__task');
    const metaEl  = panel.querySelector('.ai-status__meta');

    if (agentEl) agentEl.textContent = agent || 'AI';
    if (taskEl)  taskEl.textContent  = task  || 'Trabajando…';

    const metaParts = [];
    if (item)  metaParts.push(`📌 ${item}`);
    if (phase) metaParts.push(`📦 ${phase}`);
    if (since) metaParts.push(`⏱ desde ${since}`);
    if (eta)   metaParts.push(`🎯 ETA ${eta}`);

    if (metaEl) metaEl.textContent = metaParts.join('  ·  ');
  }

  /* ── Issues panel ─────────────────────────────────────── */

  function updateIssues(doc) {
    const badge = $('issues-badge');
    const panel = $('issues-panel');
    const issues = (doc && doc.issues) || [];

    if (badge) {
      badge.textContent = issues.length ? String(issues.length) : '';
      badge.style.display = issues.length ? '' : 'none';
    }

    if (!panel) return;
    panel.innerHTML = '';

    if (!issues.length) {
      panel.innerHTML = '<div class="issues-empty">✅ Sin advertencias de planificación</div>';
      return;
    }

    for (const iss of issues) {
      const el = document.createElement('div');
      el.className = `issue issue--${iss.level}`;
      el.innerHTML = `
        <span class="issue__icon">${iss.level === 'error' ? '🔴' : iss.level === 'warn' ? '🟡' : 'ℹ️'}</span>
        <span class="issue__msg">${escHtml(iss.message)}</span>
        ${iss.detail ? `<span class="issue__detail">${escHtml(iss.detail)}</span>` : ''}
      `;
      panel.appendChild(el);
    }
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ── Header meta ──────────────────────────────────────── */

  function updateHeader(doc, fileName) {
    const titleEl    = $('project-title');
    const subtitleEl = $('project-subtitle');
    const updatedEl  = $('project-updated');
    const fileEl     = $('file-name');

    if (doc) {
      if (titleEl)    titleEl.textContent    = doc.title    || 'Roadmap';
      if (subtitleEl) subtitleEl.textContent = doc.subtitle || '';
      if (updatedEl && doc.updated) {
        const d = global.Roadmap.toDate(doc.updated);
        updatedEl.textContent = d ? 'Actualizado ' + global.Roadmap.fmtLong(d) : '';
      } else if (updatedEl) {
        updatedEl.textContent = '';
      }
    }

    if (fileEl && fileName) fileEl.textContent = fileName;
  }

  /* ── Nav ──────────────────────────────────────────────── */

  function setView(view) {
    _view = view;

    /* actualizar nav activo */
    qa('.nav__btn').forEach(btn => {
      btn.classList.toggle('nav__btn--active', btn.dataset.view === view);
    });

    /* re-renderizar */
    renderCurrentView();

    /* persist */
    try { localStorage.setItem('vr:view', view); } catch {}
  }

  function renderCurrentView() {
    const main = $('main-view');
    if (!main) return;

    const doc = _doc;

    if (!doc) {
      main.innerHTML = '';
      main.appendChild(buildDropZone());
      return;
    }

    main.innerHTML = '';

    if (_view === 'board') {
      global.Board.render(doc, main);
    } else if (_view === 'timeline') {
      global.Timeline.render(doc, main);
    } else if (_view === 'log') {
      global.Log.render(doc, main);
    } else if (_view === 'issues') {
      renderIssuesView(doc, main);
    }
  }

  function renderIssuesView(doc, container) {
    const issues = doc.issues || [];
    container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'issues-view';

    if (!issues.length) {
      wrap.innerHTML = '<div class="issues-empty issues-empty--big">✅ Planificación sin advertencias</div>';
    } else {
      for (const iss of issues) {
        const el = document.createElement('div');
        el.className = `issue issue--${iss.level} issue--full`;
        el.innerHTML = `
          <span class="issue__icon">${iss.level === 'error' ? '🔴' : iss.level === 'warn' ? '🟡' : 'ℹ️'}</span>
          <div class="issue__body">
            <div class="issue__msg">${escHtml(iss.message)}</div>
            ${iss.detail ? `<div class="issue__detail">${escHtml(iss.detail)}</div>` : ''}
            <div class="issue__kind">${escHtml(iss.kind)}</div>
          </div>
        `;
        wrap.appendChild(el);
      }
    }

    container.appendChild(wrap);
  }

  /* ── Drop zone (estado inicial) ─────────────────────── */

  function buildDropZone() {
    const zone = document.createElement('div');
    zone.className = 'drop-zone';
    zone.id = 'drop-zone';
    zone.innerHTML = `
      <div class="drop-zone__inner">
        <div class="drop-zone__icon">📄</div>
        <h2 class="drop-zone__title">Abre tu ROADMAP.md</h2>
        <p class="drop-zone__desc">Selecciona el archivo y el visor se actualiza en vivo</p>
        <button class="drop-zone__btn btn-pick" id="btn-pick-inner">Seleccionar archivo</button>
        <p class="drop-zone__alt">o arrastra y suelta aquí · Ctrl+V para pegar</p>
      </div>
    `;

    zone.querySelector('#btn-pick-inner').addEventListener('click', () => {
      global.Watcher.pickFile();
    });

    global.Watcher.setupDragDrop(zone);
    return zone;
  }

  /* ── Live indicator ──────────────────────────────────── */

  function setLiveIndicator(live) {
    const el = $('live-dot');
    if (!el) return;
    el.classList.toggle('live-dot--on',  live);
    el.classList.toggle('live-dot--off', !live);
    el.title = live ? 'Actualizando en vivo' : 'Sin actualización en vivo';
  }

  /* ── Event listeners ─────────────────────────────────── */

  document.addEventListener('roadmap:update', e => {
    const text = e.detail && e.detail.content;
    if (!text) return;
    try {
      _doc = global.Roadmap.parse(text);
    } catch (err) {
      console.error('[App] parse error', err);
      toast('Error al parsear el ROADMAP.md', 'error');
      return;
    }
    updateHeader(_doc, e.detail.fileName);
    updateAIStatus(_doc);
    updateIssues(_doc);
    renderCurrentView();
  });

  document.addEventListener('roadmap:file-open', e => {
    const name = e.detail && e.detail.name;
    updateHeader(null, name);
    setLiveIndicator(true);
    toast(`📄 ${name || 'ROADMAP.md'} abierto`, 'ok');
  });

  document.addEventListener('roadmap:no-live', () => {
    _noLive = true;
    setLiveIndicator(false);
    toast('Sin actualización en vivo — arrastra de nuevo para refrescar', 'warn', 5000);
  });

  document.addEventListener('roadmap:no-fsa', () => {
    toast('File System Access API no disponible. Usa drag & drop o Ctrl+V', 'warn', 6000);
  });

  /* ── Init ────────────────────────────────────────────── */

  function init() {
    /* Nav buttons */
    qa('.nav__btn').forEach(btn => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });

    /* File picker button */
    const pickBtn = $('btn-pick');
    if (pickBtn) pickBtn.addEventListener('click', () => global.Watcher.pickFile());

    /* Restore last view */
    try {
      const saved = localStorage.getItem('vr:view');
      if (saved) _view = saved;
    } catch {}

    /* Activate correct nav btn */
    qa('.nav__btn').forEach(btn => {
      btn.classList.toggle('nav__btn--active', btn.dataset.view === _view);
    });

    /* Paste fallback */
    global.Watcher.setupPaste();

    /* Initial render (drop zone) */
    renderCurrentView();

    /* Auto-refresh title */
    setInterval(() => {
      if (_doc) updateAIStatus(_doc); /* re-read in case frontmatter changed externally */
    }, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(typeof window !== 'undefined' ? window : globalThis);
