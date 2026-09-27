/* timeline.js — Deliverables Timeline / Progress Tracker view
   Matches the Voidfront / RSI Progress Tracker style:
   - Subnav: EQUIPOS | ENTREGABLES
   - Controls: Search, Zoom (6H, 1 DÍA, 3 DÍAS, 1 SEMANA, 1 MES), Nav (<, AHORA, >)
   - Left column: VERSIÓN · HECHAS with task ID (T041, T042...) and title
   - Right grid: Time marks, AHORA pill marker + vertical line guide, timeline bars
*/

(function (global) {
  'use strict';

  const R = global.Roadmap;

  let currentZoom = '1d';   /* '6h' | '1d' | '3d' | '1w' | '1m' */
  let searchQuery = '';

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }

  function render(doc, container) {
    container.innerHTML = '';

    if (!doc || !doc.items || !doc.items.length) {
      container.appendChild(h('div', { class: 'empty-state' },
        h('div', { class: 'empty-state__icon' }, '📅'),
        h('p', {}, 'No hay tareas o entregables cargados en el ROADMAP.md.')
      ));
      return;
    }

    /* ── 1. Top Subnav & Toolbar ─────────────────────────── */
    const subnavBar = h('div', { class: 'subnav-bar' },
      /* Tabs: EQUIPOS | ENTREGABLES */
      h('div', { class: 'subnav-tabs' },
        h('button', { class: 'subnav-tab' }, 'EQUIPOS'),
        h('button', { class: 'subnav-tab subnav-tab--active' }, 'ENTREGABLES')
      ),
      /* Controls */
      h('div', { class: 'subnav-controls' },
        /* Search */
        h('div', { class: 'search-box' },
          h('input', {
            type: 'text',
            class: 'search-input',
            placeholder: 'Buscar entregables',
            value: searchQuery
          }),
          h('button', { class: 'btn-icon-toggle', title: 'Expandir' }, '⌵'),
          h('button', { class: 'btn-icon-toggle', title: 'Colapsar' }, '⌃')
        ),
        /* Zoom Pills */
        h('div', { class: 'zoom-group' },
          ...['6 H', '1 DÍA', '3 DÍAS', '1 SEMANA', '1 MES'].map(label => {
            const key = label.toLowerCase().replace(/\s+/g, '');
            const isActive = (key === '1día' && currentZoom === '1d') ||
                             (key === '6h' && currentZoom === '6h') ||
                             (key === '3días' && currentZoom === '3d') ||
                             (key === '1semana' && currentZoom === '1w') ||
                             (key === '1mes' && currentZoom === '1m');
            const btn = h('button', {
              class: `zoom-btn ${isActive ? 'zoom-btn--active' : ''}`
            }, label);
            btn.addEventListener('click', () => {
              if (key === '6h') currentZoom = '6h';
              else if (key === '1día') currentZoom = '1d';
              else if (key === '3días') currentZoom = '3d';
              else if (key === '1semana') currentZoom = '1w';
              else if (key === '1mes') currentZoom = '1m';
              render(doc, container);
            });
            return btn;
          })
        ),
        /* Time Navigation */
        h('div', { class: 'time-nav-group' },
          h('button', { class: 'btn-nav-arrow', title: 'Anterior' }, '‹'),
          h('button', { class: 'btn-nav-now', title: 'Ir al presente' }, 'AHORA'),
          h('button', { class: 'btn-nav-arrow', title: 'Siguiente' }, '›')
        )
      )
    );

    /* Search event listener */
    const searchInput = subnavBar.querySelector('.search-input');
    searchInput.addEventListener('input', e => {
      searchQuery = e.target.value.toLowerCase().trim();
      filterRows();
    });

    container.appendChild(subnavBar);

    /* ── 2. Deliverables Table Container ─────────────────── */
    const trackerContainer = h('div', { class: 'tracker-container' });
    const trackerTable = h('div', { class: 'tracker-table' });

    /* Left Panel: VERSIÓN · HECHAS */
    const leftPanel = h('div', { class: 'tracker-left' },
      h('div', { class: 'tracker-left__head' }, 'VERSIÓN · HECHAS'),
      h('div', { class: 'tracker-left__rows' })
    );

    /* Right Panel: Time header + bars */
    const rightPanel = h('div', { class: 'tracker-right' },
      h('div', { class: 'tracker-right__head' }),
      h('div', { class: 'tracker-right__rows' })
    );

    /* Build timeline columns based on zoom */
    const timeCols = generateTimeColumns(currentZoom);
    const tickW = currentZoom === '6h' ? 70 : currentZoom === '1d' ? 84 : 100;
    const totalW = timeCols.ticks.length * tickW;

    const rightHead = rightPanel.querySelector('.tracker-right__head');
    rightHead.style.width = `${totalW}px`;

    let nowIndex = timeCols.nowIndex;
    let nowLeftPx = nowIndex >= 0 ? nowIndex * tickW + (tickW / 2) : -1;

    for (let i = 0; i < timeCols.ticks.length; i++) {
      const tick = timeCols.ticks[i];
      const isNow = i === nowIndex;
      const cell = h('div', {
        class: `time-tick-cell ${isNow ? 'time-tick-cell--now' : ''}`,
        style: `width: ${tickW}px;`
      });

      if (isNow) {
        cell.appendChild(h('span', { class: 'badge-ahora-pill' }, 'AHORA'));
      } else {
        cell.textContent = tick.label;
      }
      rightHead.appendChild(cell);
    }

    /* Vertical line guide dropping down from AHORA */
    if (nowLeftPx >= 0) {
      const vLine = h('div', {
        class: 'vertical-now-line',
        style: `left: ${nowLeftPx}px;`
      });
      rightPanel.appendChild(vLine);
    }

    /* Populate items */
    const leftRows = leftPanel.querySelector('.tracker-left__rows');
    const rightRows = rightPanel.querySelector('.tracker-right__rows');
    rightRows.style.width = `${totalW}px`;

    const allItems = doc.items || [];

    allItems.forEach((it, idx) => {
      const taskId = it.taskId || `T${String(idx + 1).padStart(3, '0')}`;
      const statusClass = `task-bullet--${it.status || 'planned'}`;

      /* Left Row */
      const leftRow = h('div', { class: 'task-label-row', 'data-name': it.name.toLowerCase() },
        h('span', { class: `task-bullet ${statusClass}` }),
        h('span', { class: 'task-id-badge' }, taskId),
        h('span', { class: 'task-name-text', title: it.name }, it.name)
      );
      leftRows.appendChild(leftRow);

      /* Right Row with Bar */
      const barRow = h('div', { class: 'tracker-bar-row', 'data-name': it.name.toLowerCase() });

      /* Calculate Bar Placement */
      const placement = calculateBarPlacement(it, idx, timeCols, tickW);
      if (placement) {
        const bar = h('div', {
          class: `tracker-bar tracker-bar--${it.status || 'planned'}`,
          style: `left: ${placement.left}px; width: ${placement.width}px;`,
          title: `${taskId}: ${it.name} (${it.status})`
        }, `${taskId} ${it.name}`);
        barRow.appendChild(bar);
      }
      rightRows.appendChild(barRow);
    });

    /* Synchronize vertical scroll between left and right */
    rightPanel.addEventListener('scroll', () => {
      leftRows.scrollTop = rightPanel.scrollTop;
    });

    trackerTable.appendChild(leftPanel);
    trackerTable.appendChild(rightPanel);
    trackerContainer.appendChild(trackerTable);
    container.appendChild(trackerContainer);

    /* Initial scroll to AHORA */
    if (nowLeftPx > 300) {
      setTimeout(() => {
        rightPanel.scrollLeft = nowLeftPx - 250;
      }, 50);
    }

    function filterRows() {
      const q = searchQuery;
      leftRows.querySelectorAll('.task-label-row').forEach(row => {
        const name = row.dataset.name || '';
        row.style.display = (!q || name.includes(q)) ? '' : 'none';
      });
      rightRows.querySelectorAll('.tracker-bar-row').forEach(row => {
        const name = row.dataset.name || '';
        row.style.display = (!q || name.includes(q)) ? '' : 'none';
      });
    }
  }

  function generateTimeColumns(zoom) {
    const ticks = [];
    let nowIndex = 7; /* default around center */

    if (zoom === '6h' || zoom === '1d') {
      const hours = ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', 'AHORA', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00'];
      nowIndex = 7;
      hours.forEach((h, i) => {
        ticks.push({ label: h, index: i });
      });
    } else if (zoom === '3d') {
      const days = ['Jue 24', 'Vie 25', 'Sáb 26', 'AHORA', 'Lun 28', 'Mar 29', 'Mié 30', 'Jue 01'];
      nowIndex = 3;
      days.forEach((d, i) => {
        ticks.push({ label: d, index: i });
      });
    } else {
      const weeks = ['Sem 38', 'Sem 39', 'AHORA', 'Sem 41', 'Sem 42', 'Sem 43', 'Sem 44'];
      nowIndex = 2;
      weeks.forEach((w, i) => {
        ticks.push({ label: w, index: i });
      });
    }

    return { ticks, nowIndex };
  }

  function calculateBarPlacement(it, idx, timeCols, tickW) {
    const nowPos = timeCols.nowIndex * tickW;
    const offsetSeed = (idx * 37) % (tickW * 5);
    let left = Math.max(10, nowPos - (tickW * 3) + offsetSeed);
    let width = Math.max(tickW * 1.4, ((it.effort || 4) / 4) * tickW);

    if (it.status === 'done') {
      left = Math.max(10, nowPos - (tickW * 3) + (idx % 3) * tickW);
      width = Math.min(width, nowPos - left);
    } else if (it.status === 'active') {
      left = nowPos - (tickW * 0.5);
      width = tickW * 2.2;
    }

    return { left, width };
  }

  global.Timeline = { render };

})(typeof window !== 'undefined' ? window : globalThis);
