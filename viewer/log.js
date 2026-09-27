/* log.js — Log & checklist view
   window.Log = { render(doc, container) } */

(function (global) {
  'use strict';

  const R = global.Roadmap;

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') el.className = v;
      else el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }

  /** Extraer fecha "YYYY-MM-DD" del texto si existe */
  function extractDate(text) {
    const m = /(\d{4}-\d{2}-\d{2})/.exec(text);
    return m ? m[1] : null;
  }

  function stripDate(text) {
    return text.replace(/^\d{4}-\d{2}-\d{2}\s*[—–-]\s*/, '').trim();
  }

  function render(doc, container) {
    container.innerHTML = '';

    const log = doc.log || [];

    if (!log.length) {
      container.appendChild(
        h('div', { class: 'empty-state' },
          h('div', { class: 'empty-state__icon' }, '📓'),
          h('p', {}, global.UI.t('logEmpty'))
        )
      );
      return;
    }

    /* Agrupar por fecha */
    const groups = new Map();
    for (const entry of log) {
      const date = extractDate(entry.text) || global.UI.t('noDate');
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date).push(entry);
    }

    /* Stats rápidos */
    const total    = log.length;
    const done     = log.filter(e => e.done).length;
    const pending  = log.filter(e => !e.done && !e.cancelled).length;
    const cancelled = log.filter(e => e.cancelled).length;

    container.appendChild(
      h('div', { class: 'log-stats' },
        h('span', { class: 'log-stat log-stat--done' }, `✓ ${done} ${global.UI.t('completed')}`),
        pending    ? h('span', { class: 'log-stat log-stat--pending' },   `◯ ${pending} ${global.UI.t('pending')}`)   : null,
        cancelled  ? h('span', { class: 'log-stat log-stat--cancelled' }, `✗ ${cancelled} ${global.UI.t('cancelled')}`) : null
      )
    );

    /* Grupos de fecha, más reciente primero */
    const sortedDates = [...groups.keys()].sort((a, b) => b.localeCompare(a));

    for (const date of sortedDates) {
      const entries = groups.get(date);

      let label = date;
      if (date !== global.UI.t('noDate')) {
        const d = R.toDate(date);
        if (d) label = new Intl.DateTimeFormat(global.UI.language,{day:'numeric',month:'short',year:'numeric'}).format(d);
      }

      const group = h('div', { class: 'log-group' },
        h('div', { class: 'log-group__date' }, label),
        h('ul', { class: 'log-list' },
          ...entries.map(entry => {
            const cls = entry.done
              ? 'log-item log-item--done'
              : entry.cancelled
                ? 'log-item log-item--cancelled'
                : 'log-item log-item--pending';

            const icon = entry.done ? '✓' : entry.cancelled ? '✗' : '◯';
            const text = stripDate(entry.text);

            return h('li', { class: cls },
              h('span', { class: 'log-item__icon' }, icon),
              h('span', { class: 'log-item__text' },
                ...parseInlineMarkdown(text)
              )
            );
          })
        )
      );

      container.appendChild(group);
    }
  }

  /** Minimal inline markdown → DOM nodes */
  function parseInlineMarkdown(text) {
    const nodes = [];
    const re = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) nodes.push(document.createTextNode(text.slice(last, m.index)));
      if (m[1]) { const c = document.createElement('code'); c.textContent = m[1]; nodes.push(c); }
      else if (m[2]) { const s = document.createElement('strong'); s.textContent = m[2]; nodes.push(s); }
      else if (m[3]) {
        const a = document.createElement('a');
        a.href = m[4]; a.textContent = m[3]; a.target = '_blank'; a.rel = 'noreferrer';
        nodes.push(a);
      }
      last = re.lastIndex;
    }
    if (last < text.length) nodes.push(document.createTextNode(text.slice(last)));
    return nodes;
  }

  global.Log = { render };

})(typeof window !== 'undefined' ? window : globalThis);
