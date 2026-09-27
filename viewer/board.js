/* board.js — Kanban board view
   Columnas por release · Cards con progreso, owner, prioridad
   window.Board = { render(doc, container) } */

(function (global) {
  'use strict';

  const R = global.Roadmap;

  /* ── helpers ─────────────────────────────────────────── */

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('data-')) el.dataset[k.slice(5)] = v;
      else el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }

  function statusMeta(id) {
    return R.STATUS[id] || R.STATUS.planned;
  }

  function fmtDateShort(s) {
    if (!s) return '';
    const d = R.toDate(s);
    return d ? R.fmtShort(d) : s;
  }

  function ownerInitials(owner) {
    if (!owner) return '?';
    const s = owner.replace(/^@/, '');
    return s.slice(0, 2).toUpperCase();
  }

  const PRIO_COLOR = { P0: 'var(--danger)', P1: 'var(--warn)', P2: 'var(--blue-300)', P3: 'var(--text-4)' };

  /* ── Card ─────────────────────────────────────────────── */

  function buildCard(item) {
    const sm = statusMeta(item.status);
    const pct = item.progress || 0;
    const prioColor = PRIO_COLOR[item.priority] || 'transparent';

    const dateRange = (item.start || item.end)
      ? (item.start === item.end ? fmtDateShort(item.start) : `${fmtDateShort(item.start)} → ${fmtDateShort(item.end)}`)
      : '';

    const effortLabel = item.effort ? R.fmtEffort(item.effort) : '';

    const card = h('div', { class: `card card--${item.status}`, 'data-id': item.id, 'data-item': item.name },
      /* priority stripe */
      h('div', { class: 'card__stripe', style: `background:${prioColor}` }),
      /* body */
      h('div', { class: 'card__body' },
        /* title row */
        h('div', { class: 'card__title' },
          h('span', { class: 'card__name', title: item.name }, item.name)
        ),
        /* progress bar */
        h('div', { class: 'card__progress' },
          h('div', { class: 'card__track' },
            h('div', { class: 'card__fill', style: `width:${pct}%;background:${sm.color}` })
          ),
          h('span', { class: 'card__pct' }, `${pct}%`)
        ),
        /* meta row */
        h('div', { class: 'card__meta' },
          item.owner
            ? h('div', { class: 'card__owner', title: item.owner }, ownerInitials(item.owner))
            : null,
          item.priority
            ? h('span', { class: 'card__prio', style: `color:${prioColor};border-color:${prioColor}` }, item.priority)
            : null,
          effortLabel
            ? h('span', { class: 'card__effort' }, effortLabel)
            : null,
          dateRange
            ? h('span', { class: 'card__dates' }, dateRange)
            : null
        ),
        item.note
          ? h('div', { class: 'card__note' }, item.note)
          : null
      )
    );

    return card;
  }

  /* ── Category section ────────────────────────────────── */

  function buildCategory(cat, filter) {
    const items = cat.items.filter(i => {
      if (filter === 'all') return true;
      if (filter === 'active') return i.status === 'active' || i.status === 'blocked' || i.status === 'risk';
      if (filter === 'open') return i.status !== 'done' && i.status !== 'cancelled';
      return i.status === filter;
    });
    if (!items.length) return null;

    const section = h('div', { class: 'cat' },
      h('div', { class: 'cat__header' },
        h('span', { class: 'cat__name' }, cat.name),
        h('span', { class: 'cat__count' }, `${items.length}`)
      ),
      h('div', { class: 'cat__cards' }, ...items.map(buildCard))
    );

    /* collapse toggle */
    const header = section.querySelector('.cat__header');
    const cards  = section.querySelector('.cat__cards');
    let open = true;
    header.addEventListener('click', () => {
      open = !open;
      cards.style.display = open ? '' : 'none';
      header.classList.toggle('cat__header--closed', !open);
    });

    return section;
  }

  /* ── Release column ──────────────────────────────────── */

  function buildColumn(release, filter) {
    const sm = statusMeta(release.status);
    const pct = release.progress || 0;
    const allItems = release.categories.flatMap(c => c.items);
    const total = allItems.length;
    const done  = allItems.filter(i => i.status === 'done').length;

    const dateStr = (release.start && release.end)
      ? `${fmtDateShort(release.start)} → ${fmtDateShort(release.end)}`
      : '';

    const cats = release.categories
      .map(c => buildCategory(c, filter))
      .filter(Boolean);

    const col = h('div', { class: `col col--${release.status}` },
      /* column header */
      h('div', { class: 'col__head' },
        h('div', { class: 'col__title-row' },
          h('span', { class: `col__id` }, release.id || ''),
          h('span', { class: 'col__name' }, release.name),
          h('span', { class: `col__badge badge--${release.status}` }, sm.label)
        ),
        dateStr ? h('div', { class: 'col__dates' }, dateStr) : null,
        /* release progress */
        h('div', { class: 'col__progress' },
          h('div', { class: 'col__track' },
            h('div', { class: 'col__fill', style: `width:${pct}%;background:${sm.color}` })
          ),
          h('span', { class: 'col__pct' }, `${done}/${total} · ${pct}%`)
        )
      ),
      /* categories */
      h('div', { class: 'col__body' },
        cats.length ? cats : h('div', { class: 'col__empty' }, 'Sin ítems')
      )
    );

    return col;
  }

  /* ── Filter bar ──────────────────────────────────────── */

  function buildFilterBar(doc, onFilter) {
    const stats = doc.stats || {};
    const filters = [
      { id: 'all',     label: 'Todo',      count: stats.total },
      { id: 'active',  label: 'En curso',  count: stats.active + stats.blocked + stats.atRisk },
      { id: 'open',    label: 'Abierto',   count: stats.open },
      { id: 'done',    label: 'Hecho',     count: stats.done }
    ];

    let current = 'all';

    const bar = h('div', { class: 'board-filter' },
      ...filters.map(f => {
        const btn = h('button', { class: `board-filter__btn${f.id === current ? ' board-filter__btn--active' : ''}`, 'data-filter': f.id },
          f.label,
          f.count != null ? h('span', { class: 'board-filter__count' }, String(f.count)) : null
        );
        btn.addEventListener('click', () => {
          bar.querySelectorAll('.board-filter__btn').forEach(b => b.classList.remove('board-filter__btn--active'));
          btn.classList.add('board-filter__btn--active');
          current = f.id;
          onFilter(f.id);
        });
        return btn;
      })
    );

    return { el: bar, getCurrent: () => current };
  }

  /* ── Stats bar ───────────────────────────────────────── */

  function buildStatsBar(doc) {
    const s = doc.stats || {};

    function stat(label, value, cls) {
      return h('div', { class: `bstat ${cls || ''}` },
        h('span', { class: 'bstat__val' }, String(value)),
        h('span', { class: 'bstat__lbl' }, label)
      );
    }

    const effortStr = s.effortLeft > 0 ? `${s.effortLeft}h restantes` : '—';
    const spanStr   = s.spanDays  > 0  ? `${s.spanDays}d de proyecto`  : '—';

    return h('div', { class: 'board-stats' },
      stat('Progreso',  `${s.progress || 0}%`,  'bstat--progress'),
      stat('Ítems',     `${s.done||0}/${s.total||0}`, 'bstat--items'),
      stat('En curso',  s.active || 0,           'bstat--active'),
      s.blocked > 0 ? stat('Bloqueado', s.blocked, 'bstat--blocked') : null,
      s.atRisk   > 0 ? stat('En riesgo', s.atRisk,  'bstat--risk')    : null,
      stat('Esfuerzo',  effortStr,               'bstat--effort'),
      stat('Plazo',     spanStr,                 'bstat--span')
    );
  }

  /* ── Main render ─────────────────────────────────────── */

  function render(doc, container) {
    container.innerHTML = '';

    if (!doc || !doc.releases || !doc.releases.length) {
      container.appendChild(h('div', { class: 'empty-state' },
        h('div', { class: 'empty-state__icon' }, '📋'),
        h('p', {}, 'No hay releases en el ROADMAP.')
      ));
      return;
    }

    /* stats bar */
    container.appendChild(buildStatsBar(doc));

    /* filter bar */
    let currentFilter = 'all';
    const columns = h('div', { class: 'board-cols' });

    const rebuildCols = (filter) => {
      columns.innerHTML = '';
      for (const rel of doc.releases) {
        columns.appendChild(buildColumn(rel, filter));
      }
    };

    const { el: filterBar } = buildFilterBar(doc, f => {
      currentFilter = f;
      rebuildCols(f);
    });

    container.appendChild(filterBar);
    rebuildCols(currentFilter);
    container.appendChild(columns);
  }

  global.Board = { render };

})(typeof window !== 'undefined' ? window : globalThis);
