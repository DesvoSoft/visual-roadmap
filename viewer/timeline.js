/* timeline.js — Gantt / Timeline view
   window.Timeline = { render(doc, container) }
   
   Estructura:
   ┌──────────────────┬──────────────────────────────────────────┐
   │ Panel izquierdo  │  Cabecera meses / semanas (sticky)       │
   │ (item names)     │  Barras por ítem                         │
   │                  │  Línea "hoy"                              │
   │                  │  ◆ Hitos                                 │
   └──────────────────┴──────────────────────────────────────────┘ */

(function (global) {
  'use strict';

  const R = global.Roadmap;

  const LEFT_W  = 240;   /* px, ancho del panel de nombres */
  const DAY_W   = 28;    /* px por día laborable */
  const ROW_H   = 36;    /* px altura de fila */
  const HDR_H   = 52;    /* px cabecera (meses + semanas) */
  const CAT_H   = 28;    /* px fila de categoría */
  const MILESTONE_R = 8; /* radio del diamante */

  const STATUS_COLOR = {
    planned:   'var(--idle)',
    active:    'var(--blue-300)',
    blocked:   'var(--purple)',
    risk:      'var(--warn)',
    done:      'var(--ok)',
    cancelled: 'var(--text-5)'
  };

  /* ── DOM helpers ─────────────────────────────────────── */

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

  /* ── Date math helpers ───────────────────────────────── */

  /** Devuelve array de days laborables (Date[]) entre start y end inclusive */
  function workdayRange(startDate, endDate) {
    const days = [];
    for (let d = new Date(startDate); d <= endDate; d = R.addDays(d, 1)) {
      if (!R.isWeekend(d)) days.push(new Date(d));
    }
    return days;
  }

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth()    === b.getMonth()    &&
           a.getDate()     === b.getDate();
  }

  /** Índice (0-based) del día en workdays[] */
  function dayIndex(workdays, date) {
    const t = date.getTime();
    return workdays.findIndex(d => d.getTime() === t);
  }

  /** Primer día del proyecto que aparece en workdays */
  function clampToWorkdays(workdays, dateStr) {
    if (!dateStr) return -1;
    const target = R.toDate(dateStr);
    if (!target) return -1;
    /* Busca el día laborable más cercano >= target */
    for (let i = 0; i < workdays.length; i++) {
      if (workdays[i] >= target) return i;
    }
    return workdays.length - 1;
  }

  /* ── Timeline header (meses + semanas) ──────────────── */

  function buildHeader(workdays) {
    const monthCells = [];
    const weekCells  = [];

    let mStart = 0, mName = null;
    let wStart = 0;

    for (let i = 0; i <= workdays.length; i++) {
      const d = workdays[i];

      /* semana: lunes → break */
      if (i > 0 && (i === workdays.length || workdays[i].getDay() === 1)) {
        const wW = (i - wStart) * DAY_W;
        const wLabel = wStart < workdays.length
          ? `${workdays[wStart].getDate()} ${MONTHS_SHORT[workdays[wStart].getMonth()]}`
          : '';
        weekCells.push(h('div', { class: 'hdr-week', style: `width:${wW}px` }, wLabel));
        wStart = i;
      }

      /* mes: cambio de mes → break */
      if (i === workdays.length || (i > 0 && d.getMonth() !== workdays[i - 1].getMonth())) {
        const mW = (i - mStart) * DAY_W;
        monthCells.push(h('div', { class: 'hdr-month', style: `width:${mW}px` }, mName || ''));
        mStart = i;
        if (d) mName = MONTHS[d.getMonth()] + ' ' + d.getFullYear();
      } else if (i === 0) {
        mName = MONTHS[d.getMonth()] + ' ' + d.getFullYear();
      }
    }

    return h('div', { class: 'tl-header', style: `height:${HDR_H}px;min-width:${workdays.length * DAY_W}px` },
      h('div', { class: 'tl-header__months' }, ...monthCells),
      h('div', { class: 'tl-header__weeks'  }, ...weekCells)
    );
  }

  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const MONTHS_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

  /* ── Today marker ────────────────────────────────────── */

  function buildTodayLine(workdays, totalRows) {
    const today = R.today();
    const idx   = dayIndex(workdays, today);
    if (idx < 0) return null;

    const x = idx * DAY_W + DAY_W / 2;
    const totalH = totalRows * ROW_H;

    const line = h('div', { class: 'tl-today',
      style: `left:${x}px;height:${totalH}px` },
      h('div', { class: 'tl-today__label' }, 'hoy')
    );
    return line;
  }

  /* ── Bar for one item ────────────────────────────────── */

  function buildBar(item, workdays) {
    const startIdx = clampToWorkdays(workdays, item.start);
    const endIdx   = clampToWorkdays(workdays, item.end);
    if (startIdx < 0 || endIdx < 0) return null;

    const x = startIdx * DAY_W;
    const w = Math.max((endIdx - startIdx + 1) * DAY_W, DAY_W);
    const pct = item.progress || 0;
    const color = STATUS_COLOR[item.status] || STATUS_COLOR.planned;

    const tooltip = [
      item.name,
      item.start && item.end ? `${item.start} → ${item.end}` : '',
      item.effort ? R.fmtEffort(item.effort) : '',
      item.owner  ? item.owner : ''
    ].filter(Boolean).join(' · ');

    const bar = h('div', { class: `tl-bar tl-bar--${item.status}`,
      style: `left:${x}px;width:${w}px`,
      title: tooltip
    },
      h('div', { class: 'tl-bar__fill',
        style: `width:${pct}%;background:${color}` }
      ),
      w > 60
        ? h('span', { class: 'tl-bar__label' },
            item.name.length > 18 ? item.name.slice(0, 16) + '…' : item.name
          )
        : null
    );

    return bar;
  }

  /* ── Milestone diamond ───────────────────────────────── */

  function buildMilestone(ms, workdays) {
    const idx = clampToWorkdays(workdays, ms.date);
    if (idx < 0) return null;

    const x = idx * DAY_W + DAY_W / 2 - MILESTONE_R;
    const color = ms.status === 'done' ? 'var(--ok)' : ms.status === 'risk' ? 'var(--warn)' : 'var(--gold)';

    return h('div', { class: 'tl-milestone',
      style: `left:${x}px`,
      title: `${ms.name} · ${ms.date}`
    },
      h('div', { class: 'tl-milestone__diamond', style: `background:${color}` }),
      h('div', { class: 'tl-milestone__name' }, ms.name)
    );
  }

  /* ── Row for one item ────────────────────────────────── */

  function buildRow(item, workdays, isOdd) {
    const bar = buildBar(item, workdays);
    const cls = `tl-row${isOdd ? ' tl-row--odd' : ''}`;

    /* left name cell */
    const nameCell = h('div', { class: 'tl-name' },
      h('span', { class: `tl-name__dot tl-name__dot--${item.status}` }),
      h('span', { class: 'tl-name__text', title: item.name },
        item.name.length > 26 ? item.name.slice(0, 24) + '…' : item.name
      ),
      item.priority
        ? h('span', { class: 'tl-name__prio' }, item.priority)
        : null
    );

    /* bar cell */
    const barCell = h('div', { class: 'tl-bars',
      style: `width:${workdays.length * DAY_W}px;position:relative;height:${ROW_H}px`
    },
      bar
    );

    return { nameCell, barCell, cls };
  }

  /* ── Category header row ─────────────────────────────── */

  function buildCatRow(catName) {
    const left = h('div', { class: 'tl-cat-name' }, catName);
    const right = h('div', { class: 'tl-cat-bar',
      style: `width:100%;height:${CAT_H}px` });
    return { left, right };
  }

  /* ── Main render ─────────────────────────────────────── */

  function render(doc, container) {
    container.innerHTML = '';

    if (!doc || !doc.releases || !doc.releases.length) {
      container.appendChild(h('div', { class: 'empty-state' },
        h('div', { class: 'empty-state__icon' }, '📅'),
        h('p', {}, 'No hay releases con fechas en el ROADMAP.')
      ));
      return;
    }

    /* Calcular rango total de días laborables */
    const allItems = doc.items || [];
    const starts   = allItems.map(i => i.start).filter(Boolean).sort();
    const ends     = allItems.map(i => i.end).filter(Boolean).sort();
    const msStarts = (doc.milestones || []).map(m => m.date).filter(Boolean);

    const globalStart = [...starts, ...msStarts].sort()[0];
    const globalEnd   = [...ends, ...msStarts].sort().slice(-1)[0];

    if (!globalStart || !globalEnd) {
      container.appendChild(h('div', { class: 'empty-state' },
        h('div', { class: 'empty-state__icon' }, '📅'),
        h('p', {}, 'Los ítems no tienen fechas asignadas todavía.')
      ));
      return;
    }

    /* Añadir 1 semana de padding a cada lado */
    const rangeStart = R.addDays(R.toDate(globalStart), -5);
    const rangeEnd   = R.addDays(R.toDate(globalEnd), 5);
    const workdays   = workdayRange(rangeStart, rangeEnd);

    if (!workdays.length) return;

    /* Contenedor con scroll horizontal */
    const wrapper = h('div', { class: 'tl-wrapper' });

    /* Panel de nombres (sticky) + panel de barras */
    const leftPanel  = h('div', { class: 'tl-left' },
      h('div', { class: 'tl-left__hdr', style: `height:${HDR_H}px` }, ''),
    );
    const rightPanel = h('div', { class: 'tl-right' });
    const rightHead  = buildHeader(workdays);
    rightPanel.appendChild(rightHead);

    let totalRows = 0;
    const barGroups = []; /* para la línea de hoy (necesita conocer totalRows) */

    /* Iterar por release → category → item */
    for (const rel of doc.releases) {
      /* Release separator */
      const relLabel = h('div', { class: 'tl-release-label' },
        h('span', { class: `tl-release-id tl-release-id--${rel.status}` }, rel.id),
        h('span', { class: 'tl-release-name' }, rel.name)
      );
      leftPanel.appendChild(relLabel);
      const relDivider = h('div', { class: 'tl-release-divider',
        style: `width:${workdays.length * DAY_W}px;height:24px` });
      rightPanel.appendChild(relDivider);

      for (const cat of rel.categories) {
        /* Category header */
        const { left: catLeft, right: catRight } = buildCatRow(cat.name);
        leftPanel.appendChild(catLeft);
        rightPanel.appendChild(catRight);

        let rowParity = 0;
        for (const item of cat.items) {
          if (item.status === 'cancelled') continue;
          const { nameCell, barCell, cls } = buildRow(item, workdays, rowParity % 2 === 1);

          const leftRow  = h('div', { class: cls + ' tl-row--left',
            style: `height:${ROW_H}px` }, nameCell);
          const rightRow = h('div', { class: cls + ' tl-row--right',
            style: `height:${ROW_H}px` }, barCell);

          leftPanel.appendChild(leftRow);
          rightPanel.appendChild(rightRow);
          barGroups.push(rightRow);
          totalRows++;
          rowParity++;
        }
      }
    }

    /* Milestones (flotan sobre el panel de barras) */
    const msLayer = h('div', { class: 'tl-ms-layer',
      style: `width:${workdays.length * DAY_W}px;height:${totalRows * ROW_H}px;` +
             `top:${HDR_H + 24}px` });
    for (const ms of doc.milestones || []) {
      const mEl = buildMilestone(ms, workdays);
      if (mEl) msLayer.appendChild(mEl);
    }

    /* Línea de hoy */
    const todayLine = buildTodayLine(workdays, totalRows + 2);

    const rightScroll = h('div', { class: 'tl-right-scroll' },
      rightPanel,
      todayLine,
      msLayer
    );

    wrapper.appendChild(leftPanel);
    wrapper.appendChild(rightScroll);
    container.appendChild(wrapper);
  }

  global.Timeline = { render };

})(typeof window !== 'undefined' ? window : globalThis);
