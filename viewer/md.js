/* md.js — dependency-free parser for ROADMAP.md
   Produces window.Roadmap = { parse, ...helpers } */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * primitives
   * ------------------------------------------------------------------ */

  const DAY = 86400000;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /** Parse YYYY-MM-DD -> {y,m,d} in local time (avoids UTC shift bugs). */
  function parts(dateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim());
    if (!m) return null;
    return { y: +m[1], m: +m[2], d: +m[3] };
  }

  function toDate(dateStr) {
    const p = parts(dateStr);
    if (!p) return null;
    return new Date(p.y, p.m - 1, p.d);
  }

  function fmt(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function today() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function addDays(date, n) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  }

  function diffDays(a, b) {
    return Math.round((b - a) / DAY);
  }

  function isWeekend(date) {
    const d = date.getDay();
    return d === 0 || d === 6;
  }

  /** Working days between two dates, inclusive of the start, exclusive of the end+1. */
  function workDays(startStr, endStr) {
    const a = toDate(startStr), b = toDate(endStr);
    if (!a || !b || b < a) return 0;
    let n = 0;
    for (let d = new Date(a); d <= b; d = addDays(d, 1)) if (!isWeekend(d)) n++;
    return n;
  }

  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function fmtShort(date) {
    return date.getDate() + ' ' + MONTHS[date.getMonth()];
  }

  function fmtLong(date) {
    return date.getDate() + ' ' + MONTHS[date.getMonth()] + ' ' + date.getFullYear();
  }

  /** "4h" | "2d" | "90m" | "1.5h" | "1w" -> hours (number|null) */
  function parseEffort(raw) {
    if (raw == null) return null;
    const s = String(raw).trim().toLowerCase();
    if (!s || s === '—' || s === '-' || s === '?') return null;
    const m = /^([\d.,]+)\s*(h|d|w|m)?$/.exec(s);
    if (!m) return null;
    const n = parseFloat(m[1].replace(',', '.'));
    if (!isFinite(n)) return null;
    switch (m[2]) {
      case 'd': return n * 8;
      case 'w': return n * 40;
      case 'm': return n / 60;
      default: return n;
    }
  }

  function fmtEffort(hours) {
    if (hours == null) return '—';
    if (hours < 1) return Math.round(hours * 60) + 'm';
    if (hours % 8 === 0) return hours / 8 + 'd';
    return (Math.round(hours * 10) / 10) + 'h';
  }

  /* ------------------------------------------------------------------ *
   * enums
   * ------------------------------------------------------------------ */

  const STATUS = {
    planned: { id: 'planned', label: 'Planeado', color: 'var(--idle)', cls: 'st-planned' },
    active: { id: 'active', label: 'En curso', color: 'var(--blue-300)', cls: 'st-active' },
    blocked: { id: 'blocked', label: 'Bloqueado', color: 'var(--danger)', cls: 'st-blocked' },
    risk: { id: 'risk', label: 'En riesgo', color: 'var(--warn)', cls: 'st-risk' },
    done: { id: 'done', label: 'Hecho', color: 'var(--ok)', cls: 'st-done' },
    cancelled: { id: 'cancelled', label: 'Descartado', color: 'var(--text-5)', cls: 'st-cancelled' }
  };

  const STATUS_ALIASES = {
    planned: 'planned', backlog: 'planned', todo: 'planned', 'to do': 'planned', pending: 'planned', new: 'planned',
    active: 'active', doing: 'active', wip: 'active', progress: 'active', 'in progress': 'active', started: 'active',
    blocked: 'blocked', block: 'blocked', stuck: 'blocked',
    risk: 'risk', 'at-risk': 'risk', 'at risk': 'risk', delayed: 'risk', slip: 'risk',
    done: 'done', complete: 'done', completed: 'done', finished: 'done', shipped: 'done', delivered: 'done', closed: 'done',
    cancelled: 'cancelled', canceled: 'cancelled', dropped: 'cancelled', wontfix: 'cancelled', 'won\'t do': 'cancelled', skipped: 'cancelled'
  };

  const PRIORITY = {
    P0: { id: 'P0', label: 'P0', color: 'var(--danger)' },
    P1: { id: 'P1', label: 'P1', color: 'var(--warn)' },
    P2: { id: 'P2', label: 'P2', color: 'var(--blue-400)' },
    P3: { id: 'P3', label: 'P3', color: 'var(--text-4)' }
  };

  const PRIORITY_ALIASES = {
    p0: 'P0', crit: 'P0', critical: 'P0', urgent: 'P0', 'blocker': 'P0',
    p1: 'P1', high: 'P1', important: 'P1',
    p2: 'P2', med: 'P2', medium: 'P2', normal: 'P2', low: 'P3',
    p3: 'P3', nice: 'P3', someday: 'P3'
  };

  function normKey(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim();
  }

  function normStatus(s) {
    const k = normKey(s);
    if (!k) return null;
    if (STATUS[k]) return k;
    if (STATUS_ALIASES[k]) return STATUS_ALIASES[k];
    const m = /^(st[- ]?)?(planned|active|blocked|risk|done|cancelled)/.exec(k);
    return m ? m[2] : null;
  }

  function normPriority(s) {
    const k = normKey(s);
    if (!k || k === '—' || k === '-') return null;
    if (PRIORITY[k.toUpperCase()]) return k.toUpperCase();
    return PRIORITY_ALIASES[k] || null;
  }

  function parseProgress(s) {
    if (s == null) return null;
    const m = /(\d{1,3})\s*%?/.exec(String(s));
    if (!m) return null;
    return Math.max(0, Math.min(100, parseInt(m[1], 10)));
  }

  function parseDate(s) {
    const t = String(s == null ? '' : s).trim();
    if (!t || t === '—' || t === '-' || t === '?') return null;
    if (parts(t)) return t;
    /* "28/09" or "28/09/2026" or "sept 2026" (month precision) */
    const dmy = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(t);
    if (dmy) {
      const y = dmy[3] ? (+dmy[3] < 100 ? 2000 + +dmy[3] : +dmy[3]) : null;
      if (y) return y + '-' + pad(+dmy[2]) + '-' + pad(+dmy[1]);
      return { month: +dmy[2], day: +dmy[1], year: null };
    }
    const my = /^(\d{1,2})[/.-](\d{4})$/.exec(t);
    if (my) return { month: +my[1], year: +my[2] };
    return null;
  }

  /* ------------------------------------------------------------------ *
   * frontmatter (YAML subset: scalars, inline arrays, block lists)
   * ------------------------------------------------------------------ */

  function parseFrontmatter(src) {
    const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(src);
    if (!m) return { data: {}, body: src, raw: '' };
    const data = {};
    const lines = m[1].split(/\r?\n/);
    let key = null;
    for (const line of lines) {
      if (!line.trim() || /^\s*#/.test(line)) continue;
      const item = /^\s*-\s+(.*)$/.exec(line);
      if (item && key) {
        if (!Array.isArray(data[key])) data[key] = data[key] ? [data[key]] : [];
        data[key].push(scalar(item[1]));
        continue;
      }
      const kv = /^([A-Za-z0-9_.\-]+)\s*:\s*(.*)$/.exec(line);
      if (!kv) continue;
      key = kv[1];
      const raw = kv[2].trim();
      if (raw === '') { data[key] = []; continue; }
      if (/^\[.*\]$/.test(raw)) {
        data[key] = raw.slice(1, -1).split(',').map(s => scalar(s)).filter(s => s !== '');
      } else {
        data[key] = scalar(raw);
      }
    }
    return { data, body: src.slice(m[0].length), raw: m[1] };
  }

  function scalar(v) {
    let s = String(v).trim();
    if (/^".*"$/.test(s) || /^'.*'$/.test(s)) s = s.slice(1, -1);
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null' || s === '~') return null;
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    if (/^-?\d*\.\d+$/.test(s)) return parseFloat(s);
    return s;
  }

  /* ------------------------------------------------------------------ *
   * inline markdown
   * ------------------------------------------------------------------ */

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Minimal inline md -> html: `code`, **bold**, *italic*, [text](url) */
  function inline(s) {
    let out = escapeHtml(s);
    const codes = [];
    out = out.replace(/`([^`]+)`/g, (_, c) => ' ' + (codes.push(c) - 1) + ' ');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    out = out.replace(/ (\d+) /g, (_, i) => '<code>' + escapeHtml(codes[+i]) + '</code>');
    return out;
  }

  /* ------------------------------------------------------------------ *
   * block parsing
   * ------------------------------------------------------------------ */

  const TABLE_SEP = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

  function splitRow(line) {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
    const cells = [];
    let cur = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
      if (ch === '|') { cells.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  }

  function isTableSep(line) {
    return line.indexOf('|') !== -1 && TABLE_SEP.test(line);
  }

  /** Read a markdown table starting at index i. Returns {header, rows, next}. */
  function readTable(lines, i) {
    const header = splitRow(lines[i]);
    let j = i + 1;
    if (j >= lines.length || !isTableSep(lines[j])) return null;
    j++;
    const rows = [];
    while (j < lines.length && lines[j].indexOf('|') !== -1 && lines[j].trim() !== '') {
      const cells = splitRow(lines[j]);
      const row = {};
      header.forEach((h, k) => { row[normKey(h)] = cells[k] == null ? '' : cells[k]; });
      rows.push(row);
      j++;
    }
    return { header: header.map(normKey), rows, next: j };
  }

  const ITEM_FIELDS = [
    ['item', ['item', 'tarea', 'task', 'nombre', 'name', 'entregable', 'deliverable']],
    ['status', ['estado', 'status']],
    ['progress', ['progreso', 'progress', 'avance', 'pct', '%']],
    ['owner', ['owner', 'responsable', 'asignado', 'assigned', 'equipo', 'team']],
    ['effort', ['esfuerzo', 'effort', 'horas', 'hours', 'est', 'h']],
    ['start', ['inicio', 'start', 'desde', 'from', 'begins']],
    ['end', ['fin', 'finish', 'end', 'hasta', 'to', 'deadline', 'entrega']],
    ['depends', ['depende', 'depends', 'deps', 'bloqueado por', 'blocked by', 'requiere', 'requires']],
    ['priority', ['prio', 'prioridad', 'priority', 'p']],
    ['note', ['nota', 'note', 'notas', 'comentario', 'comment']]
  ];

  function mapRow(row) {
    const item = { tags: [] };
    for (const [field, aliases] of ITEM_FIELDS) {
      for (const a of aliases) {
        if (row[a] !== undefined) { item[field] = row[a]; break; }
      }
    }
    /* the first unmatched column becomes the note */
    for (const k in row) {
      const known = ITEM_FIELDS.some(([, aliases]) => aliases.indexOf(k) !== -1);
      if (!known && k && row[k] && !item.note) item.note = row[k];
    }
    return item;
  }

  const EMPTY = { '—': 1, '-': 1, '': 1, '?': 1, 'n/a': 1, 'na': 1, 'tbd': 1 };

  function isEmpty(v) {
    if (v == null) return true;
    return !!EMPTY[normKey(v)];
  }

  /* release meta line:  `2026-09-28 → 2026-10-09` · **active** · 45%  */
  const RE_META_RANGE = /(\d{4}-\d{2}-\d{2})\s*(?:→|->|—>|=>|–)\s*(\d{4}-\d{2}-\d{2})/;
  const RE_META_STATUS = /\*{0,2}(planeado|planned|en curso|active|bloqueado|blocked|en riesgo|at[- ]risk|hecho|done|completo|complete|entregado|shipped|descartado|cancelled|canceled)\*{0,2}/i;
  const RE_META_PROGRESS = /(\d{1,3})\s*%/;
  const RE_ID = /^([A-Za-z]+[\w.\-]*)\s*[·:\-–—]\s*(.+)$/;

  /* ------------------------------------------------------------------ *
   * main parse
   * ------------------------------------------------------------------ */

  function parse(src) {
    const text = String(src == null ? '' : src).replace(/\r\n?/g, '\n');
    const fm = parseFrontmatter(text);
    const meta = fm.data || {};
    const lines = fm.body.split('\n');

    const doc = {
      meta: meta,
      title: meta.title || 'Roadmap',
      subtitle: meta.subtitle || meta.description || '',
      owner: meta.owner || '',
      started: parseDate(meta.started || meta['start-date']) || null,
      updated: parseDate(meta.updated || meta['last-updated']) || null,
      capacity: typeof meta.capacity === 'number' ? meta.capacity : 1,
      weekStart: normKey(meta['week-start'] || meta.week_start) === 'sun' ? 'sun' : 'mon',
      context: '',
      releases: [],
      milestones: [],
      log: [],
      warnings: []
    };

    let section = null;      /* normalized h2 name */
    let release = null;
    let category = null;
    const prose = {};        /* section -> markdown text */

    /* Prose goes to the innermost open container. */
    const sink = () => {
      if (release && category) return { get: () => category.notes, set: v => { category.notes = v; } };
      if (release) return { get: () => release.notes, set: v => { release.notes = v; } };
      return {
        get: () => prose[section || '_pre'] || '',
        set: v => { prose[section || '_pre'] = v; }
      };
    };

    const emit = (linesArr, trailingNewline) => {
      const s = sink();
      const cur = s.get();
      let add = linesArr.join('\n');
      if (cur && !trailingNewline) add = cur + '\n\n' + add;
      else if (cur) add = cur + '\n' + add;
      s.set(add);
    };

    const flushSection = () => {
      if (!section) return;
      if (/^(contexto|context|resumen|summary|overview|descripcion)$/.test(section)) {
        doc.context = prose[section] || '';
      }
    };

    for (let i = 0; i < lines.length;) {
      const line = lines[i];

      /* ---- fenced code: keep verbatim ---- */
      const fence = /^```(\w*)\s*$/.exec(line);
      if (fence) {
        const buf = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        emit(buf, true);
        continue;
      }

      if (line.trim() === '') { i++; continue; }

      /* ---- headings ---- */
      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        const level = h[1].length;
        const text2 = h[2].trim();
        if (level === 1) { i++; continue; }
        if (level === 2) {
          flushSection();
          section = normKey(text2);
          prose[section] = prose[section] || '';
          release = null; category = null;
          i++;
          continue;
        }
        if (level === 3) {
          if (/^(releases|entregables|hitos|milestones)$/.test(section)) {
            if (/^(releases|entregables)$/.test(section)) {
              release = newRelease(text2);
              doc.releases.push(release);
              category = null;
            }
          } else {
            release = null; category = null;
          }
          i++;
          continue;
        }
        if (level === 4) {
          if (release) { category = { name: text2, items: [], notes: '' }; release.categories.push(category); }
          i++;
          continue;
        }
        i++;
        continue;
      }

      /* ---- tables ---- */
      if (line.indexOf('|') !== -1 && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        const t = readTable(lines, i);
        if (t) {
          ingestTable(doc, t, section, release, category);
          i = t.next;
          continue;
        }
      }

      /* ---- checklists ---- */
      const check = /^\s*[-*]\s+\[([ xX~\-/])\]\s*(.*)$/.exec(line);
      if (check) {
        const state = check[1].toLowerCase();
        doc.log.push({
          done: state === 'x',
          cancelled: state === '-' || state === '/',
          text: check[2].trim()
        });
        i++;
        continue;
      }

      /* ---- release meta line: `2026-09-28 → 2026-10-09` · **active** · 45% ---- */
      if (release && RE_META_RANGE.test(line)) {
        const rm = RE_META_RANGE.exec(line);
        release.start = rm[1];
        release.end = rm[2];
        const sm = RE_META_STATUS.exec(line);
        if (sm) release.status = normStatus(sm[1]);
        const pm = RE_META_PROGRESS.exec(line);
        if (pm) release.progress = parseProgress(pm[0]);
        i++;
        continue;
      }

      /* ---- everything else is prose for the innermost open container ---- */
      emit([line], true);
      i++;
    }

    flushSection();
    normalize(doc);
    return doc;
  }

  function newRelease(heading) {
    const idm = RE_ID.exec(heading);
    const r = {
      id: idm ? idm[1] : null,
      name: idm ? idm[2].trim() : heading,
      status: null,
      progress: null,
      start: null,
      end: null,
      notes: '',
      categories: []
    };
    /* inline meta on the heading line, e.g. ### R1 · Cimientos — active */
    const sm = RE_META_STATUS.exec(heading);
    if (sm) r.status = normStatus(sm[1]);
    const rm = RE_META_RANGE.exec(heading);
    if (rm) { r.start = rm[1]; r.end = rm[2]; }
    const pm = RE_META_PROGRESS.exec(heading);
    if (pm) r.progress = parseProgress(pm[0]);
    return r;
  }

  function ingestTable(doc, t, section, release, category) {
    const has = n => t.header.indexOf(normKey(n)) !== -1;
    const isItemTable = has('Item') || has('Tarea') || has('Task') || has('Entregable') || has('Deliverable');
    const isMilestoneTable = has('Hito') || has('Milestone');

    if (isMilestoneTable) {
      for (const row of t.rows) {
        const pick = (...names) => {
          for (const n of names) { const k = normKey(n); if (row[k] !== undefined) return row[k]; }
          return '';
        };
        const date = pick('Fecha', 'Date');
        if (isEmpty(date)) continue;
        doc.milestones.push({
          name: pick('Hito', 'Milestone', 'Nombre', 'Name') || 'Hito',
          date: parseDate(date),
          release: pick('Release', 'Entregable', 'Release id') || null,
          status: normStatus(pick('Estado', 'Status')) || 'planned',
          note: pick('Nota', 'Note')
        });
      }
      return;
    }

    if (!isItemTable) return;

    for (const row of t.rows) {
      const raw = mapRow(row);
      if (isEmpty(raw.item)) continue;
      const owner = isEmpty(raw.owner) ? null : String(raw.owner).trim();
      const item = {
        id: null,
        name: String(raw.item).trim(),
        status: normStatus(raw.status) || 'planned',
        progress: parseProgress(raw.progress),
        owner: owner,
        effort: parseEffort(raw.effort),
        effortRaw: isEmpty(raw.effort) ? null : String(raw.effort).trim(),
        start: isEmpty(raw.start) ? null : parseDate(raw.start),
        end: isEmpty(raw.end) ? null : parseDate(raw.end),
        depends: isEmpty(raw.depends) ? []
          : String(raw.depends).split(/[,;]/).map(s => s.trim()).filter(Boolean),
        priority: normPriority(raw.priority),
        note: isEmpty(raw.note) ? null : String(raw.note).trim(),
        release: release ? release.name : null,
        releaseId: release ? release.id : null,
        category: category ? category.name : 'Sin categoría'
      };
      if (typeof item.start === 'object') item.start = null;   /* partial dates unsupported */
      if (typeof item.end === 'object') item.end = null;
      if (item.progress == null) item.progress = item.status === 'done' ? 100 : 0;
      if (category) category.items.push(item);
      else if (release) release.categories.push({ name: 'Sin categoría', items: [item], notes: '' });
    }
  }

  /* ------------------------------------------------------------------ *
   * normalization + derived data
   * ------------------------------------------------------------------ */

  function normalize(doc) {
    const seen = new Map();
    const slug = s => String(s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';

    doc.releases.forEach((r, ri) => {
      if (!r.id) r.id = 'R' + (ri + 1);
      r.categories.forEach(c => {
        c.items.forEach(it => {
          let base = slug(it.name);
          let id = base, n = 2;
          while (seen.has(id)) id = base + '-' + n++;
          seen.set(id, true);
          it.id = id;
          it.releaseKey = r.id;
          if (it.start && it.end && it.end < it.start) { const t = it.start; it.start = it.end; it.end = t; }
          if (!it.start && it.end) it.start = it.end;
          if (!it.end && it.start) it.end = it.start;
        });
      });

      const items = r.categories.flatMap(c => c.items);
      r.items = items;
      if (!r.start) r.start = items.map(i => i.start).filter(Boolean).sort()[0] || null;
      if (!r.end) r.end = items.map(i => i.end).filter(Boolean).sort().slice(-1)[0] || null;
      if (!r.progress) r.progress = weightedProgress(items);
      if (!r.status) r.status = deriveStatus(r);
    });

    doc.items = doc.releases.flatMap(r => r.items);
    doc.byId = new Map(doc.items.map(i => [i.id, i]));
    doc.milestones.forEach(m => {
      if (typeof m.date === 'object' && m.date) {
        const dd = m.date.day || 1;
        m.date = m.date.year + '-' + pad(m.date.month) + '-' + pad(Math.min(dd, 28));
      }
    });
    doc.milestones.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    doc.stats = stats(doc);
    doc.issues = checkRealism(doc);
    return doc;
  }

  function weightedProgress(items) {
    let w = 0, acc = 0;
    for (const it of items) {
      if (it.status === 'cancelled') continue;
      const weight = it.effort || 1;
      w += weight;
      acc += weight * (it.progress || 0);
    }
    return w ? Math.round(acc / w) : 0;
  }

  function deriveStatus(r) {
    const items = r.items.filter(i => i.status !== 'cancelled');
    if (!items.length) return 'planned';
    if (items.every(i => i.status === 'done')) return 'done';
    if (items.some(i => i.status === 'blocked')) return 'blocked';
    if (items.some(i => i.status === 'risk')) return 'risk';
    if (items.some(i => i.status === 'active' || (i.progress || 0) > 0)) return 'active';
    return 'planned';
  }

  function stats(doc) {
    const items = doc.items || [];
    const active = items.filter(i => i.status === 'active');
    const open = items.filter(i => i.status !== 'done' && i.status !== 'cancelled');
    const effortLeft = open.reduce((a, i) => a + (i.effort || 0) * (1 - (i.progress || 0) / 100), 0);
    const done = items.filter(i => i.status === 'done').length;
    const spanStart = items.map(i => i.start).filter(Boolean).sort()[0] || null;
    const spanEnd = items.map(i => i.end).filter(Boolean).sort().slice(-1)[0] || null;
    const nextUp = open
      .filter(i => i.start)
      .sort((a, b) => a.start.localeCompare(b.start) || (a.priority || 'P9').localeCompare(b.priority || 'P9'))[0] || null;
    return {
      total: items.length,
      done: done,
      open: open.length,
      active: active.length,
      blocked: items.filter(i => i.status === 'blocked').length,
      atRisk: items.filter(i => i.status === 'risk').length,
      progress: weightedProgress(items),
      effortTotal: items.reduce((a, i) => a + (i.effort || 0), 0),
      effortLeft: Math.round(effortLeft * 10) / 10,
      spanStart: spanStart,
      spanEnd: spanEnd,
      spanDays: spanStart && spanEnd ? diffDays(toDate(spanStart), toDate(spanEnd)) + 1 : 0,
      releases: doc.releases.length,
      nextUp: nextUp,
      updated: doc.updated
    };
  }

  /** Tiempos realistas: detecta lo que un humano detectaría al leer el gantt. */
  function checkRealism(doc) {
    const out = [];
    const items = (doc.items || []).filter(i => i.status !== 'cancelled');
    const t = today();
    const todayStr = fmt(t);
    const cap = Math.max(1, doc.capacity || 1);
    const hoursPerDay = 6;                       /* horas efectivas por día de trabajo */
    const perDay = cap * hoursPerDay;

    /* 1. sobre-asignación por owner y día (solo trabajo vivo: lo hecho ya no compete) */
    const load = new Map();
    for (const it of items) {
      if (it.status === 'done') continue;
      if (!it.start || !it.end || !it.owner) continue;
      const hoursPerDayItem = it.effort
        ? it.effort / Math.max(1, workDays(it.start, it.end))
        : perDay;
      for (let d = toDate(it.start); ; d = addDays(d, 1)) {
        if (isWeekend(d)) { if (fmt(d) > it.end) break; else continue; }
        const k = it.owner + '|' + fmt(d);
        load.set(k, (load.get(k) || 0) + hoursPerDayItem);
        if (fmt(d) >= it.end) break;
        if (d.getFullYear() > t.getFullYear() + 6) break;
      }
    }
    const overload = new Map();
    for (const [k, v] of load) {
      if (v <= perDay + 0.51) continue;
      const [owner, day] = k.split('|');
      const o = overload.get(owner) || { owner, days: 0, worst: 0, worstDay: null, total: 0 };
      o.days++; o.total += v - perDay;
      if (v - perDay > o.worst) { o.worst = v - perDay; o.worstDay = day; }
      overload.set(owner, o);
    }
    for (const o of overload.values()) {
      const who = o.owner.charAt(0) === '@' ? o.owner : '@' + o.owner;
      out.push({
        level: 'warn', kind: 'sobreasignacion',
        message: who + ' sobre-asignado ' + o.days + ' día(s), picos de +' +
          (Math.round(o.worst * 10) / 10) + 'h (capacidad ' + cap + ').',
        detail: o.worstDay ? 'Peor día: ' + fmtLong(toDate(o.worstDay)) : '',
        refs: []
      });
    }

    /* 2. fechas vencidas y sin terminar */
    const late = items.filter(i => i.end && i.end < todayStr && i.status !== 'done');
    if (late.length) {
      out.push({
        level: 'warn', kind: 'vencido',
        message: late.length + ' ítem(s) con fecha fin pasada y sin completar.',
        detail: late.slice(0, 3).map(i => i.name).join(', ') + (late.length > 3 ? '…' : ''),
        refs: late.map(i => i.id)
      });
    }

    /* 3. dependencias incumplidas o ausentes */
    for (const it of items) {
      for (const dep of it.depends) {
        const target = findByName(doc, dep);
        if (!target) {
          out.push({ level: 'error', kind: 'dependencia', message: '"' + it.name + '" depende de "' + dep + '", que no existe.', detail: '', refs: [it.id] });
        } else if (it.start && target.end && it.start < target.end && target.status !== 'done') {
          out.push({
            level: 'error', kind: 'dependencia',
            message: '"' + it.name + '" empieza ' + it.start + ' antes de que termine "' + target.name + '" (' + target.end + ').',
            detail: '', refs: [it.id, target.id]
          });
        }
      }
    }

    /* 4. ítems sin fecha dentro de un release con fechas */
    for (const r of doc.releases) {
      const noDate = r.items.filter(i => !i.start && i.status !== 'done');
      if (noDate.length && r.start) {
        out.push({
          level: 'warn', kind: 'sin-fecha',
          message: r.items.length + ' ítem(s) sin fecha en ' + r.id + ' (' + noDate.length + ' pendientes).',
          detail: noDate.slice(0, 3).map(i => i.name).join(', '), refs: noDate.map(i => i.id)
        });
      }
    }

    /* 5. esfuerzo incoherente con la duración */
    for (const it of items) {
      if (!it.effort || !it.start || !it.end) continue;
      const wd = workDays(it.start, it.end);
      if (wd === 0) continue;
      const perDayEffort = it.effort / wd;
      if (it.effort >= 8 && perDayEffort > perDay * 1.6) {
        out.push({
          level: 'warn', kind: 'esfuerzo',
          message: '"' + it.name + '": ' + fmtEffort(it.effort) + ' en ' + wd + ' día(s) = ' +
            (Math.round(perDayEffort * 10) / 10) + 'h/día, muy por encima de la capacidad.',
          detail: '', refs: [it.id]
        });
      }
      if (it.effort <= 2 && wd >= 5) {
        out.push({
          level: 'info', kind: 'esfuerzo',
          message: '"' + it.name + '": ' + fmtEffort(it.effort) + ' repartido en ' + wd + ' día(s) — ventana demasiado amplia.',
          detail: '', refs: [it.id]
        });
      }
    }

    /* 6. progreso incoherente con el estado */
    for (const it of items) {
      if (it.status === 'done' && it.progress < 100) {
        out.push({ level: 'info', kind: 'progreso', message: '"' + it.name + '" está hecho pero marca ' + it.progress + '%.', detail: '', refs: [it.id] });
      }
      if (it.status === 'planned' && it.progress > 0) {
        out.push({ level: 'info', kind: 'progreso', message: '"' + it.name + '" está planeado pero marca ' + it.progress + '%.', detail: '', refs: [it.id] });
      }
    }

    const order = { error: 0, warn: 1, info: 2 };
    out.sort((a, b) => order[a.level] - order[b.level]);
    return out;
  }

  function findByName(doc, name) {
    const k = normKey(name);
    if (doc.byId.has(k)) return doc.byId.get(k);
    for (const it of doc.items) if (normKey(it.name) === k) return it;
    for (const it of doc.items) if (normKey(it.name).indexOf(k) !== -1) return it;
    return null;
  }

  /* ------------------------------------------------------------------ */

  global.Roadmap = {
    parse: parse,
    inline: inline,
    escapeHtml: escapeHtml,
    normKey: normKey,
    normStatus: normStatus,
    normPriority: normPriority,
    parseEffort: parseEffort,
    fmtEffort: fmtEffort,
    parseDate: parseDate,
    parts: parts,
    toDate: toDate,
    fmt: fmt,
    fmtShort: fmtShort,
    fmtLong: fmtLong,
    today: today,
    addDays: addDays,
    diffDays: diffDays,
    workDays: workDays,
    isWeekend: isWeekend,
    DAY: DAY,
    STATUS: STATUS,
    PRIORITY: PRIORITY
  };
})(typeof window !== 'undefined' ? window : globalThis);
