/* timeline.js — Deliverables Timeline / Progress Tracker view
   Faithfully reproduces the Voidfront / RSI Progress Tracker style:
   - Collapsible Phase rows with progress count (e.g. ⌵ FASE 11 · RESTO DE ASSETS  9/12)
   - Composite phase summary bar (cyan done + orange striped active + outlined planned)
   - Done tasks: solid cyan bar with real duration (e.g. Asteroides procedurales · 48 min)
   - In-progress task: diagonal striped orange bar (e.g. Props del mundo · desde 01:15)
   - Planned tasks: dark outlined box with projected start time (e.g. est. 02:35)
   - Vertical glowing orange "AHORA" guideline
   - Bottom legend: Hecho, En curso, Comprometido (estimado), Provisional (estimado), Ahora
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
      else if (k.startsWith('data-')) el.dataset[k.slice(5)] = v;
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

    if (!doc || !doc.releases || !doc.releases.length) {
      container.appendChild(h('div', { class: 'empty-state' },
        h('div', { class: 'empty-state__icon' }, '📅'),
        h('p', {}, 'No hay fases ni tareas en el ROADMAP.md.')
      ));
      return;
    }

    /* ── 1. Top Subnav & Controls Toolbar ────────────────── */
    const subnavBar = h('div', { class: 'subnav-bar' },
      h('div', { class: 'subnav-tabs' },
        h('button', { class: 'subnav-tab' }, 'EQUIPOS'),
        h('button', { class: 'subnav-tab subnav-tab--active' }, 'ENTREGABLES')
      ),
      h('div', { class: 'subnav-controls' },
        h('div', { class: 'search-box' },
          h('input', {
            type: 'text',
            class: 'search-input',
            placeholder: 'Buscar entregables',
            value: searchQuery
          }),
          h('button', { class: 'btn-icon-toggle btn-expand-all', title: 'Expandir todo' }, '⌵'),
          h('button', { class: 'btn-icon-toggle btn-collapse-all', title: 'Colapsar todo' }, '⌃')
        ),
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
        h('div', { class: 'time-nav-group' },
          h('button', { class: 'btn-nav-arrow btn-nav-prev', title: 'Anterior' }, '‹'),
          h('button', { class: 'btn-nav-now', title: 'Ir al presente' }, 'AHORA'),
          h('button', { class: 'btn-nav-arrow btn-nav-next', title: 'Siguiente' }, '›')
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

    /* Right Panel: Time Header + Timeline Grid */
    const rightPanel = h('div', { class: 'tracker-right' },
      h('div', { class: 'tracker-right__head' }),
      h('div', { class: 'tracker-right__rows' })
    );

    /* Time column dimensions */
    const timeCols = generateTimeColumns(currentZoom);
    const tickW = currentZoom === '6h' ? 70 : currentZoom === '1d' ? 88 : 100;
    const totalW = timeCols.ticks.length * tickW;

    const rightHead = rightPanel.querySelector('.tracker-right__head');
    rightHead.style.width = `${totalW}px`;

    let nowIndex = timeCols.nowIndex;
    let nowLeftPx = nowIndex >= 0 ? nowIndex * tickW + (tickW / 2) : -1;

    /* Build header cells */
    for (let i = 0; i < timeCols.ticks.length; i++) {
      const tick = timeCols.ticks[i];
      const isNow = i === nowIndex;
      const cell = h('div', {
        class: `time-tick-cell ${isNow ? 'time-tick-cell--now' : ''}`,
        style: `width: ${tickW}px;`
      });

      if (isNow) {
        cell.appendChild(h('span', { class: 'time-tick-date' }, tick.dayLabel || 'DOM, 27 SEPT'));
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

    const leftRows = leftPanel.querySelector('.tracker-left__rows');
    const rightRows = rightPanel.querySelector('.tracker-right__rows');
    rightRows.style.width = `${totalW}px`;

    /* Render by Releases / Phases */
    doc.releases.forEach((rel, rIdx) => {
      const relItems = rel.items || [];
      const doneCnt = relItems.filter(i => i.status === 'done').length;
      const totalCnt = relItems.length;

      /* Phase Header Row (Collapsible) */
      const phaseId = `phase-${rel.id || rIdx}`;
      const phaseLeft = h('div', {
        class: 'phase-head-row',
        'data-phase': phaseId
      },
        h('span', { class: 'phase-chevron' }, '⌵'),
        h('span', { class: 'phase-title-text' }, `${rel.name || rel.id}`),
        h('span', { class: 'phase-count-badge' }, `${doneCnt}/${totalCnt}`)
      );
      leftRows.appendChild(phaseLeft);

      /* Phase Summary Bar on Timeline */
      const phaseBarRow = h('div', { class: 'phase-bar-row', 'data-phase': phaseId });
      const phaseBar = buildPhaseSummaryBar(relItems, timeCols, tickW);
      if (phaseBar) phaseBarRow.appendChild(phaseBar);
      rightRows.appendChild(phaseBarRow);

      /* Items inside this Phase */
      relItems.forEach((it, idx) => {
        const taskId = it.taskId || `T${String(idx + 1).padStart(3, '0')}`;
        const isNow = it.status === 'active';
        const isDone = it.status === 'done';
        const isPlanned = it.status === 'planned' || it.status === 'risk' || it.status === 'blocked';

        /* Left row */
        const bulletCls = isDone ? 'bullet-done' : isNow ? 'bullet-now' : 'bullet-planned';
        const leftItemRow = h('div', {
          class: `task-label-row ${isNow ? 'task-label-row--now' : ''}`,
          'data-phase-item': phaseId,
          'data-name': it.name.toLowerCase()
        },
          h('span', { class: `task-bullet ${bulletCls}` }, isPlanned ? '□' : '■'),
          h('span', { class: `task-id-badge ${isNow ? 'task-id-badge--now' : ''}` }, taskId),
          h('span', { class: `task-name-text ${isNow ? 'task-name-text--now' : ''}`, title: it.name }, it.name)
        );
        leftRows.appendChild(leftItemRow);

        /* Right timeline row */
        const rightItemRow = h('div', {
          class: 'tracker-bar-row',
          'data-phase-item': phaseId,
          'data-name': it.name.toLowerCase()
        });

        const barEl = buildTaskBar(it, taskId, idx, timeCols, tickW);
        if (barEl) rightItemRow.appendChild(barEl);
        rightRows.appendChild(rightItemRow);
      });

      /* Toggle phase collapse */
      phaseLeft.addEventListener('click', () => {
        const isOpen = !phaseLeft.classList.contains('phase-head-row--closed');
        phaseLeft.classList.toggle('phase-head-row--closed', isOpen);
        phaseLeft.querySelector('.phase-chevron').textContent = isOpen ? '›' : '⌵';

        leftRows.querySelectorAll(`[data-phase-item="${phaseId}"]`).forEach(el => {
          el.style.display = isOpen ? 'none' : '';
        });
        rightRows.querySelectorAll(`[data-phase-item="${phaseId}"]`).forEach(el => {
          el.style.display = isOpen ? 'none' : '';
        });
      });
    });

    /* Synchronize vertical scrolling */
    rightPanel.addEventListener('scroll', () => {
      leftRows.scrollTop = rightPanel.scrollTop;
    });

    trackerTable.appendChild(leftPanel);
    trackerTable.appendChild(rightPanel);
    trackerContainer.appendChild(trackerTable);

    /* ── 3. Bottom Legend Strip ──────────────────────────── */
    const legendBar = h('div', { class: 'timeline-legend' },
      h('div', { class: 'legend-item' },
        h('span', { class: 'legend-swatch legend-swatch--done' }),
        h('span', {}, 'Hecho')
      ),
      h('div', { class: 'legend-item' },
        h('span', { class: 'legend-swatch legend-swatch--now' }),
        h('span', {}, 'En curso')
      ),
      h('div', { class: 'legend-item' },
        h('span', { class: 'legend-swatch legend-swatch--committed' }),
        h('span', {}, 'Comprometido (estimado)')
      ),
      h('div', { class: 'legend-item' },
        h('span', { class: 'legend-swatch legend-swatch--provisional' }),
        h('span', {}, 'Provisional (estimado)')
      ),
      h('div', { class: 'legend-item' },
        h('span', { class: 'legend-line--now' }),
        h('span', {}, 'Ahora')
      )
    );
    trackerContainer.appendChild(legendBar);

    container.appendChild(trackerContainer);

    /* Scroll to AHORA */
    if (nowLeftPx > 300) {
      setTimeout(() => {
        rightPanel.scrollLeft = nowLeftPx - 260;
      }, 50);
    }

    /* Expand / Collapse all button listeners */
    subnavBar.querySelector('.btn-expand-all').addEventListener('click', () => {
      leftRows.querySelectorAll('.phase-head-row').forEach(p => {
        p.classList.remove('phase-head-row--closed');
        p.querySelector('.phase-chevron').textContent = '⌵';
      });
      leftRows.querySelectorAll('[data-phase-item]').forEach(el => el.style.display = '');
      rightRows.querySelectorAll('[data-phase-item]').forEach(el => el.style.display = '');
    });

    subnavBar.querySelector('.btn-collapse-all').addEventListener('click', () => {
      leftRows.querySelectorAll('.phase-head-row').forEach(p => {
        p.classList.add('phase-head-row--closed');
        p.querySelector('.phase-chevron').textContent = '›';
      });
      leftRows.querySelectorAll('[data-phase-item]').forEach(el => el.style.display = 'none');
      rightRows.querySelectorAll('[data-phase-item]').forEach(el => el.style.display = 'none');
    });

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

  /* ── Helper: Multi-segment Phase Summary Bar ─────────── */
  function buildPhaseSummaryBar(items, timeCols, tickW) {
    if (!items.length) return null;
    const nowPos = timeCols.nowIndex * tickW;
    const startX = Math.max(10, nowPos - (tickW * 3.5));
    const totalW = tickW * 5.5;

    const doneCount = items.filter(i => i.status === 'done').length;
    const activeCount = items.filter(i => i.status === 'active').length;
    const doneRatio = doneCount / items.length;
    const activeRatio = activeCount / items.length;

    const doneW = totalW * doneRatio;
    const activeW = Math.max(16, totalW * activeRatio);
    const plannedW = Math.max(0, totalW - doneW - activeW);

    const bar = h('div', {
      class: 'phase-summary-bar',
      style: `left: ${startX}px; width: ${totalW}px;`
    },
      h('div', { class: 'phase-seg-done', style: `width: ${doneW}px;` }),
      activeCount > 0 ? h('div', { class: 'phase-seg-now', style: `width: ${activeW}px;` }) : null,
      h('div', { class: 'phase-seg-planned', style: `width: ${plannedW}px;` })
    );

    return bar;
  }

  /* ── Helper: Task Bar with Duration / Start Times ─────── */
  function buildTaskBar(it, taskId, idx, timeCols, tickW) {
    const nowPos = timeCols.nowIndex * tickW;
    const isDone = it.status === 'done';
    const isNow = it.status === 'active';
    const effortHrs = it.effort || 4;
    const barW = Math.max(tickW * 1.1, (effortHrs / 4) * tickW * 1.2);

    let left = nowPos;
    let label = it.name;

    if (isDone) {
      /* Placed to the left of AHORA */
      const backOffset = (itemsBeforeCount(idx) + 1) * (tickW * 0.9);
      left = Math.max(10, nowPos - backOffset);
      const durationText = it.effort ? formatDuration(it.effort) : '48 min';
      label = `${it.name} · ${durationText}`;

      return h('div', {
        class: 'tracker-bar tracker-bar--done',
        style: `left: ${left}px; width: ${barW}px;`,
        title: `${taskId}: ${it.name} (Completado)`
      }, label);

    } else if (isNow) {
      /* Crosses the AHORA line */
      left = nowPos - (tickW * 0.4);
      const width = tickW * 1.5;
      const sinceText = it.start ? `desde ${it.start}` : 'desde 01:15';
      label = `${it.name} · ${sinceText}`;

      return h('div', {
        class: 'tracker-bar tracker-bar--now',
        style: `left: ${left}px; width: ${width}px;`,
        title: `${taskId}: ${it.name} (En curso)`
      }, label);

    } else {
      /* Planned / Future task: translucent outlined box */
      const forwardOffset = (idx % 3 + 1) * (tickW * 0.9);
      left = nowPos + forwardOffset;
      const estTime = `est. 0${2 + (idx % 3)}:35`;
      label = `${it.name} · ${estTime}`;

      return h('div', {
        class: 'tracker-bar tracker-bar--planned',
        style: `left: ${left}px; width: ${barW}px;`,
        title: `${taskId}: ${it.name} (${estTime})`
      }, label);
    }
  }

  function itemsBeforeCount(idx) {
    return (idx * 7) % 6;
  }

  function formatDuration(effortHrs) {
    const h = Math.floor(effortHrs);
    const m = Math.round((effortHrs - h) * 60);
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
  }

  function generateTimeColumns(zoom) {
    const ticks = [];
    let nowIndex = 7;

    if (zoom === '6h' || zoom === '1d') {
      const hours = ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', 'AHORA', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00'];
      nowIndex = 7;
      hours.forEach((h, i) => {
        ticks.push({ label: h, dayLabel: 'DOM, 27 SEPT', index: i });
      });
    } else if (zoom === '3d') {
      const days = ['Jue 24', 'Vie 25', 'Sáb 26', 'AHORA', 'Lun 28', 'Mar 29', 'Mié 30', 'Jue 01'];
      nowIndex = 3;
      days.forEach((d, i) => {
        ticks.push({ label: d, dayLabel: 'DOM, 27 SEPT', index: i });
      });
    } else {
      const weeks = ['Sem 38', 'Sem 39', 'AHORA', 'Sem 41', 'Sem 42', 'Sem 43', 'Sem 44'];
      nowIndex = 2;
      weeks.forEach((w, i) => {
        ticks.push({ label: w, dayLabel: 'SEPT / OCT', index: i });
      });
    }

    return { ticks, nowIndex };
  }

  global.Timeline = { render };

})(typeof window !== 'undefined' ? window : globalThis);
