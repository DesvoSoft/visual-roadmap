/* lib/agent.js — deterministic ROADMAP.md edits for coding agents.
   Every function takes the file text and returns the new text, so the CLI
   and the tests share the same code. Agents call these through the CLI
   (`visual-roadmap start T002`) instead of hand-editing tables. */

'use strict';

require('../viewer/md.js');
require('../viewer/forecast.js');

const Roadmap = globalThis.Roadmap;
const Forecast = globalThis.Forecast;

const CHANGE_SECTION = /^(ultimos[- ]cambios|cambios[- ]recientes|recent[- ]changes|actividad|activity)$/;
const ESTIMATE_SECTION = /^(estimaciones|cambios de estimacion|estimate changes|estimates)$/;

/* ── time ─────────────────────────────────────────────── */

function pad(n) { return String(n).padStart(2, '0'); }
function stamp(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function clock(now) { const d = new Date(now); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function minutesLabel(m) {
  if (m < 60) return `${Math.max(1, Math.round(m))}m`;
  const h = Math.round(m / 6) / 10;
  return `${h}h`;
}

/* ── text plumbing ────────────────────────────────────── */

function split(text) {
  const eol = /\r\n/.test(text) ? '\r\n' : '\n';
  return { eol, lines: String(text).replace(/\r\n?/g, '\n').split('\n') };
}
function join({ eol, lines }) {
  /* Collapse runs of blank lines left by inserted sections (outside code fences). */
  const out = [];
  let fence = false;
  for (const line of lines) {
    if (/^```/.test(line)) fence = !fence;
    if (!fence && line.trim() === '' && out.length && out[out.length - 1].trim() === '') continue;
    out.push(line);
  }
  return out.join(eol);
}

function cellsOf(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const out = []; let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') { cur += '\\|'; i++; continue; }
    if (s[i] === '|') { out.push(cur.trim()); cur = ''; continue; }
    cur += s[i];
  }
  out.push(cur.trim());
  return out;
}
function rowOf(cells) { return `| ${cells.join(' | ')} |`; }
function safeCell(v) { return String(v).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' '); }
const isSep = line => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line) && line.includes('|');

function fieldIndex(header, field) {
  const aliases = (Roadmap.ITEM_FIELDS.find(([f]) => f === field) || [, []])[1];
  return header.findIndex(h => aliases.includes(Roadmap.normKey(h)));
}

/** Call fn(lineIndex, header, cells) for every body row of every table. */
function forEachRow(lines, fn) {
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!lines[i].includes('|') || !isSep(lines[i + 1])) continue;
    const header = cellsOf(lines[i]);
    let r = i + 2;
    for (; r < lines.length && lines[r].includes('|') && lines[r].trim(); r++) fn(r, header, cellsOf(lines[r]));
    i = r - 1;
  }
}

/** Locate the table row for a task ID. */
function findRow(lines, id) {
  const want = String(id).trim().toUpperCase();
  const idRe = new RegExp('^' + want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])', 'i');
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!lines[i].includes('|') || !isSep(lines[i + 1])) continue;
    const header = cellsOf(lines[i]);
    const itemCol = fieldIndex(header, 'item');
    let end = i + 2;
    while (end < lines.length && lines[end].includes('|') && lines[end].trim()) end++;
    if (itemCol !== -1) {
      for (let r = i + 2; r < end; r++) {
        const cells = cellsOf(lines[r]);
        if (idRe.test(cells[itemCol] || '') || cells.some(c => c.toUpperCase() === want)) {
          return { line: r, headerLine: i, end, header, cells, itemCol };
        }
      }
    }
    i = end - 1;
  }
  return null;
}

/** Add a column to a whole table when a field is missing (e.g. `Real`). */
function ensureColumn(lines, row, field, title) {
  let idx = fieldIndex(row.header, field);
  if (idx !== -1) return idx;
  for (let r = row.headerLine; r < row.end; r++) {
    const cells = cellsOf(lines[r]);
    cells.push(r === row.headerLine ? title : r === row.headerLine + 1 ? '---' : '—');
    lines[r] = rowOf(cells);
  }
  row.header.push(title);
  row.cells.push('—');
  return row.header.length - 1;
}

function setField(lines, row, field, title, value) {
  const idx = ensureColumn(lines, row, field, title);
  while (row.cells.length <= idx) row.cells.push('—');
  row.cells[idx] = safeCell(value);
  lines[row.line] = rowOf(row.cells);
}
function getField(row, field) {
  const idx = fieldIndex(row.header, field);
  return idx === -1 ? '' : row.cells[idx] || '';
}
const blank = v => !v || /^(—|-|\?|n\/a|tbd)$/i.test(String(v).trim());

/* ── frontmatter ──────────────────────────────────────── */

function frontmatter(lines) {
  if (lines[0] !== '---' && lines[0] !== '﻿---') return null;
  const close = lines.indexOf('---', 1);
  return close === -1 ? null : { open: 0, close };
}
function ensureFrontmatter(lines) {
  let fm = frontmatter(lines);
  if (!fm) { lines.unshift('---', '---', ''); fm = { open: 0, close: 1 }; }
  return fm;
}
function setMeta(lines, key, value) {
  const fm = ensureFrontmatter(lines);
  const re = new RegExp('^' + key + '\\s*:');
  for (let i = fm.open + 1; i < fm.close; i++) if (re.test(lines[i])) { lines[i] = `${key}: ${value}`; return; }
  lines.splice(fm.close, 0, `${key}: ${value}`);
}
function yamlValue(v) {
  const s = String(v);
  return /^[\w .:\-·/áéíóúñÁÉÍÓÚÑ]+$/.test(s) && !/^\d+$/.test(s) && !/:\s/.test(s) ? s : JSON.stringify(s);
}
function setNowTask(lines, task) {
  const fm = ensureFrontmatter(lines);
  for (let i = fm.open + 1; i < fm.close; i++) {
    if (/^(now_task|current_task)\s*:/.test(lines[i])) {
      let j = i + 1;
      while (j < fm.close && /^\s+\S/.test(lines[j])) j++;
      lines.splice(i, j - i);
      fm.close -= j - i;
      break;
    }
  }
  if (!task) return;
  const block = ['now_task:'];
  for (const [k, v] of Object.entries(task)) if (v != null && v !== '') block.push(`  ${k}: ${yamlValue(v)}`);
  lines.splice(fm.close, 0, ...block);
}
function nowTaskId(lines) {
  const fm = frontmatter(lines);
  if (!fm) return null;
  let inside = false;
  for (let i = fm.open + 1; i < fm.close; i++) {
    if (/^now_task\s*:/.test(lines[i])) { inside = true; continue; }
    if (inside && !/^\s+\S/.test(lines[i])) break;
    const m = inside && /^\s+id\s*:\s*["']?([^"'\s]+)/.exec(lines[i]);
    if (m) return m[1];
  }
  return null;
}
function currentTask(text) { return Roadmap.parse(text).nowTask; }

/* ── sections ─────────────────────────────────────────── */

function addToSection(lines, matcher, title, entry, prepend) {
  let head = -1;
  for (let i = 0; i < lines.length; i++) {
    const h = /^##\s+(.*)$/.exec(lines[i]);
    if (h && matcher.test(Roadmap.normKey(h[1]))) { head = i; break; }
  }
  if (head === -1) {
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    lines.push('', `## ${title}`, '', entry, '');
    return;
  }
  let end = head + 1;
  while (end < lines.length && !/^#{1,2}\s/.test(lines[end])) end++;
  const items = [];
  for (let i = head + 1; i < end; i++) if (/^\s*[-*]\s/.test(lines[i])) items.push(i);
  if (!items.length) { lines.splice(head + 1, 0, '', entry); return; }
  lines.splice(prepend ? items[0] : items[items.length - 1] + 1, 0, entry);
}
function logLine(lines, now, icon, text, diff) {
  addToSection(lines, CHANGE_SECTION, 'Últimos cambios', `- ${clock(now)} | ${icon} | ${safeCell(text)}${diff ? ` | ${diff}` : ''}`, true);
}

/* ── commands ─────────────────────────────────────────── */

function need(lines, id) {
  if (!id) throw new Error('Missing task ID, e.g. T001');
  const row = findRow(lines, id);
  if (!row) throw new Error(`Task ${id} not found in any roadmap table`);
  return row;
}
function taskName(row) {
  const raw = row.cells[row.itemCol] || '';
  return raw.replace(/^T\d+[\w-]*\s*[:·\-–—]?\s*/i, '').trim() || raw;
}
function releaseOf(text, id) {
  const doc = Roadmap.parse(text);
  const it = doc.items.find(i => (i.taskId || '').toUpperCase() === String(id).toUpperCase());
  return it ? [it.releaseId, it.release].filter(Boolean).join(' · ') : '';
}

function start(text, id, opts = {}, now = Date.now()) {
  const doc = split(text);
  const { lines } = doc;
  const row = need(lines, id);
  const taskId = String(id).toUpperCase();
  const priorStatus = Roadmap.normStatus(getField(row, 'status'));
  if (priorStatus === 'done' || priorStatus === 'cancelled') throw new Error(`${taskId} is ${priorStatus}`);
  if (priorStatus === 'paused') throw new Error(`${taskId} is paused; use resume ${taskId}`);
  const effort = getField(row, 'effort');
  const expected = opts.expected || (blank(effort) ? '' : effort);
  const warnings = [];
  if (!expected) warnings.push('No expected duration: pass --expected 40m so the viewer can show an ETA.');
  const prev = nowTaskId(lines);
  if (prev && prev.toUpperCase() !== taskId) warnings.push(`${prev} was the current task; mark it done or blocked if it is not still in progress.`);
  setField(lines, row, 'status', 'Estado', 'active');
  const begun = getField(row, 'start');
  if (blank(begun) || /^\d{4}-\d{2}-\d{2}$/.test(begun.trim())) setField(lines, row, 'start', 'Inicio', stamp(now));
  if (fieldIndex(row.header, 'end') !== -1) setField(lines, row, 'end', 'Fin', '—');
  if (expected && blank(effort)) setField(lines, row, 'effort', 'Esfuerzo', expected);
  setNowTask(lines, {
    id: taskId,
    name: taskName(row),
    context: opts.context || releaseOf(join(doc), taskId),
    started_at: stamp(now),
    expected
  });
  setMeta(lines, 'updated', stamp(now));
  logLine(lines, now, '▶', `${taskId} · ${taskName(row)}`);
  return { text: join(doc), warnings, id: taskId };
}

function done(text, id, opts = {}, now = Date.now()) {
  const doc = split(text);
  const { lines } = doc;
  const row = need(lines, id);
  const taskId = String(id).toUpperCase();
  let actual = opts.actual;
  if (!actual) {
    const parsed = Roadmap.parse(text);
    const began = parsed.nowTask && String(parsed.nowTask.id).toUpperCase() === taskId
      ? Forecast.timestamp(parsed.nowTask.startedAt)
      : Forecast.timestamp(getField(row, 'start'));
    if (began != null && /\d{2}:\d{2}/.test(parsed.nowTask?.startedAt || getField(row, 'start'))) {
      const paused = parsed.nowTask && String(parsed.nowTask.id).toUpperCase() === taskId
        ? (parsed.nowTask.pausedMinutes || 0) + (parsed.nowTask.pausedAt ? Math.max(0, (now - Forecast.timestamp(parsed.nowTask.pausedAt)) / 60000) : 0) : 0;
      actual = minutesLabel(Math.max(0, (now - began) / 60000 - paused));
    }
  }
  let diff = opts.diff;
  if (!diff && opts.diffSince) {
    const parsed = Roadmap.parse(text);
    const began = parsed.nowTask && String(parsed.nowTask.id).toUpperCase() === taskId
      ? Forecast.timestamp(parsed.nowTask.startedAt) : Forecast.timestamp(getField(row, 'start'));
    const c = began != null ? opts.diffSince(began) : null;
    if (c && (c.add || c.del)) diff = `+${c.add} -${c.del}`;
  }
  setField(lines, row, 'status', 'Estado', 'done');
  setField(lines, row, 'progress', 'Progreso', '100%');
  setField(lines, row, 'end', 'Fin', stamp(now));
  if (actual) setField(lines, row, 'actual', 'Real', actual);
  if (opts.note) setField(lines, row, 'note', 'Nota', opts.note);
  if ((nowTaskId(lines) || '').toUpperCase() === taskId) setNowTask(lines, null);
  setMeta(lines, 'updated', stamp(now));
  logLine(lines, now, '✓', `${taskId} · ${taskName(row)}${opts.note ? ' — ' + opts.note : ''}`, diff);
  let result = { text: join(doc), warnings: [], id: taskId, actual, diff };
  /* Chain straight into the next task so the viewer never shows "no task". */
  if (opts.next) {
    const next = opts.next === true ? readyNext(result.text, taskId) : opts.next;
    if (next) { const started = start(result.text, next, {}, now); result = { ...result, text: started.text, next, warnings: started.warnings }; }
  }
  return result;
}

function block(text, id, reason, now = Date.now()) {
  if (!reason) throw new Error('Say why it is blocked: visual-roadmap block T003 "reason"');
  const doc = split(text);
  const { lines } = doc;
  const row = need(lines, id);
  setField(lines, row, 'status', 'Estado', 'blocked');
  if ((nowTaskId(lines) || '').toUpperCase() === String(id).toUpperCase()) setNowTask(lines, null);
  setMeta(lines, 'updated', stamp(now));
  logLine(lines, now, '⚠', `${String(id).toUpperCase()} bloqueada: ${reason}`);
  return { text: join(doc), warnings: [], id: String(id).toUpperCase() };
}
function pause(text, id, reason, now = Date.now()) {
  const doc = split(text), row = need(doc.lines, id), task = currentTask(text);
  if (Roadmap.normStatus(getField(row, 'status')) !== 'active' || !task || task.id.toUpperCase() !== String(id).toUpperCase()) throw new Error(`${id} is not the current active task`);
  setField(doc.lines, row, 'status', 'Estado', 'paused');
  setNowTask(doc.lines, { id: task.id, name: task.name, context: task.context, started_at: task.startedAt, expected: task.expected, paused_at: stamp(now), paused_minutes: task.pausedMinutes || 0 });
  setMeta(doc.lines, 'updated', stamp(now));
  logLine(doc.lines, now, 'Ⅱ', `${task.id} paused${reason ? ': ' + reason : ''}`);
  return { text: join(doc), warnings: [], id: task.id };
}
function resume(text, id, now = Date.now()) {
  const doc = split(text), row = need(doc.lines, id), task = currentTask(text);
  if (Roadmap.normStatus(getField(row, 'status')) !== 'paused' || !task || task.id.toUpperCase() !== String(id).toUpperCase()) throw new Error(`${id} is not the current paused task`);
  const pausedAt = Forecast.timestamp(task.pausedAt);
  const pausedMinutes = (task.pausedMinutes || 0) + (pausedAt == null ? 0 : Math.max(0, (now - pausedAt) / 60000));
  setField(doc.lines, row, 'status', 'Estado', 'active');
  setNowTask(doc.lines, { id: task.id, name: task.name, context: task.context, started_at: task.startedAt, expected: task.expected, paused_minutes: Math.round(pausedMinutes) });
  setMeta(doc.lines, 'updated', stamp(now));
  logLine(doc.lines, now, '▶', `${task.id} resumed`);
  return { text: join(doc), warnings: [], id: task.id };
}

function progress(text, id, pct, now = Date.now()) {
  const n = parseInt(String(pct).replace('%', ''), 10);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error('Progress must be 0-100');
  const doc = split(text);
  const { lines } = doc;
  const row = need(lines, id);
  setField(lines, row, 'progress', 'Progreso', `${n}%`);
  setMeta(lines, 'updated', stamp(now));
  return { text: join(doc), warnings: [], id: String(id).toUpperCase() };
}

function eta(text, id, remaining, reason, now = Date.now()) {
  if (Forecast.minutes(remaining) == null) throw new Error(`Remaining time "${remaining}" not understood; use 25m, 1.5h or 01:10`);
  if (!reason) throw new Error('Give the reason for the new ETA; the viewer shows it next to the estimate.');
  const doc = split(text);
  const { lines } = doc;
  need(lines, id);
  addToSection(lines, ESTIMATE_SECTION, 'Estimaciones', `- ${stamp(now)} | ${String(id).toUpperCase()} | ${remaining} | ${safeCell(reason)}`, false);
  setMeta(lines, 'updated', stamp(now));
  logLine(lines, now, '↻', `${String(id).toUpperCase()} ETA ${remaining}: ${reason}`);
  return { text: join(doc), warnings: [], id: String(id).toUpperCase() };
}

function note(text, message, opts = {}, now = Date.now()) {
  if (!message) throw new Error('Nothing to log');
  const doc = split(text);
  setMeta(doc.lines, 'updated', stamp(now));
  logLine(doc.lines, now, opts.icon || '📄', message, opts.diff);
  return { text: join(doc), warnings: [] };
}

/* ── planning: add and split tasks without touching tables ── */

const TABLE_HEADER = ['Item', 'Estado', 'Progreso', 'Esfuerzo', 'Inicio', 'Fin', 'Depende', 'Real'];

function nextId(lines) {
  let max = 0;
  for (const line of lines) for (const m of line.matchAll(/\|\s*T(\d+)\b/gi)) max = Math.max(max, +m[1]);
  return 'T' + String(max + 1).padStart(3, '0');
}

/** Line range of a release (### heading) inside ## Releases / ## Entregables. */
function releases(lines) {
  const out = [];
  let inside = false;
  for (let i = 0; i < lines.length; i++) {
    const h2 = /^##\s+(.*)$/.exec(lines[i]);
    if (h2) { inside = /^(releases|entregables)$/.test(Roadmap.normKey(h2[1])); if (out.length) out[out.length - 1].end ??= i; continue; }
    const h3 = inside && /^###\s+(.*)$/.exec(lines[i]);
    if (h3) {
      if (out.length) out[out.length - 1].end ??= i;
      out.push({ line: i, title: h3[1].trim(), end: null });
    }
  }
  if (out.length) out[out.length - 1].end ??= lines.length;
  return out;
}

function matchRelease(list, wanted) {
  const w = Roadmap.normKey(wanted);
  return list.find(r => Roadmap.normKey(r.title) === w)
    || list.find(r => Roadmap.normKey(r.title.split(/\s*[·:\-–—]\s*/)[0]) === w)
    || list.find(r => Roadmap.normKey(r.title).includes(w));
}

/** Where a new task goes: the named release, else the active task's, else the last open one. */
function targetRelease(lines, text, wanted) {
  let list = releases(lines);
  if (wanted) {
    const found = matchRelease(list, wanted);
    if (found) return found;
    let at = lines.findIndex(l => /^##\s+(releases|entregables)\s*$/i.test(l.trim()));
    if (at === -1) {
      const firstH2 = lines.findIndex((l, i) => i > (frontmatter(lines)?.close ?? -1) && /^##\s/.test(l));
      at = firstH2 === -1 ? lines.length : firstH2;
      lines.splice(at, 0, '## Releases', '');
    }
    let end = at + 1;
    while (end < lines.length && !/^##\s/.test(lines[end])) {
      if (/^<!--.*-->\s*$/.test(lines[end].trim())) { lines.splice(end, 1); continue; }   /* seed placeholder */
      end++;
    }
    while (end > at + 1 && lines[end - 1].trim() === '') end--;
    lines.splice(end, 0, '', `### ${wanted}`, '');
    list = releases(lines);
    return matchRelease(list, wanted);
  }
  const doc = Roadmap.parse(text);
  const active = doc.items.find(i => i.status === 'active');
  const open = doc.releases.filter(r => r.status !== 'done' && r.status !== 'cancelled');
  const pick = active ? doc.releases.find(r => r.items.includes(active)) : open[open.length - 1] || doc.releases[doc.releases.length - 1];
  if (!pick) throw new Error('No release to add to: pass --release "v0.1 · Name"');
  return list.find(r => r.title.includes(pick.name)) || list[list.length - 1];
}

/** Insert a task row; returns its new ID. `after` places it right below another row. */
function insertTask(lines, text, name, opts) {
  const id = nextId(lines);
  const afterRow = opts.after ? findRow(lines, opts.after) : null;
  const rel = targetRelease(lines, text, afterRow && !opts.release ? releases(lines).find(r => r.line < afterRow.line && afterRow.line < r.end)?.title : opts.release);
  /* Tables of the release, each tagged with the #### subgroup above it */
  const tables = [];
  let group = '', groupLine = -1;
  for (let i = rel.line + 1; i < rel.end; i++) {
    const h4 = /^####\s+(.*)$/.exec(lines[i]);
    if (h4) { group = h4[1].trim(); groupLine = i; continue; }
    if (lines[i].includes('|') && i + 1 < rel.end && isSep(lines[i + 1])) {
      let j = i + 2;
      while (j < rel.end && lines[j].includes('|') && lines[j].trim()) j++;
      tables.push({ header: cellsOf(lines[i]), headerLine: i, lastRow: j - 1, group, groupLine });
      i = j - 1;
    }
  }
  let table = null;
  if (opts.group) {
    const wanted = Roadmap.normKey(opts.group);
    table = tables.find(tb => Roadmap.normKey(tb.group) === wanted) || tables.find(tb => tb.group && Roadmap.normKey(tb.group).includes(wanted));
    if (!table) {
      /* New subgroup at the end of the release, with the columns of its sibling tables */
      let at = rel.end;
      while (at > rel.line + 1 && lines[at - 1].trim() === '') at--;
      const header = tables.length ? tables[tables.length - 1].header : TABLE_HEADER;
      lines.splice(at, 0, '', `#### ${safeCell(opts.group)}`, '', rowOf(header), rowOf(header.map(() => '---')));
      table = { header, headerLine: at + 3, lastRow: at + 4 };
    }
  } else if (afterRow) table = tables.find(tb => tb.headerLine < afterRow.line && afterRow.line <= tb.lastRow);
  table ??= tables[tables.length - 1];
  let header, headerLine, lastRow;
  if (table) ({ header, headerLine, lastRow } = table);
  else {
    let at = rel.line + 1;
    while (at < rel.end && lines[at].trim() && !lines[at].includes('|')) at++;   /* keep the release meta line */
    header = TABLE_HEADER;
    lines.splice(at, 0, '', rowOf(header), rowOf(header.map(() => '---')));
    headerLine = at + 1; lastRow = at + 2;
  }
  const values = { item: `${id} ${safeCell(name)}`, status: 'planned', progress: '0%', effort: opts.effort || '—', depends: opts.depends || '—', note: opts.note || '—' };
  const cells = header.map(h => {
    const field = Roadmap.ITEM_FIELDS.find(([, aliases]) => aliases.includes(Roadmap.normKey(h)));
    return field && values[field[0]] ? values[field[0]] : '—';
  });
  let at = lastRow + 1;
  if (opts.after) { const r = findRow(lines, opts.after); if (r && r.headerLine === headerLine) at = r.line + 1; }
  lines.splice(at, 0, rowOf(cells));
  return id;
}

function add(text, name, opts = {}, now = Date.now()) {
  if (!name) throw new Error('Task name required: visual-roadmap add "Name" --effort 30m');
  if (opts.effort && Roadmap.parseEffort(opts.effort) == null) throw new Error(`Effort "${opts.effort}" not understood; use 20m, 1.5h`);
  const doc = split(text);
  if (opts.after && !opts.depends) opts = { ...opts, depends: opts.after };   /* --after = placed after and depends on */
  /* A dependency on a split task means its last part (note "→ T004–T006"). */
  if (opts.depends) {
    opts = { ...opts, depends: String(opts.depends).split(/[,;\s]+/).filter(Boolean).map(dep => {
      const row = findRow(doc.lines, dep);
      const moved = row && /→\s*T\d+[\w-]*(?:\s*[–-]\s*(T\d+[\w-]*))?/.exec(getField(row, 'note'));
      return moved ? (moved[1] || /→\s*(T\d+[\w-]*)/.exec(getField(row, 'note'))[1]) : dep.toUpperCase();
    }).join(', ') };
  }
  const id = insertTask(doc.lines, text, name, opts);
  setMeta(doc.lines, 'updated', stamp(now));
  const warnings = [];
  if (!opts.effort) warnings.push('No --effort: the project ETA stays unknown until you add one.');
  else if (Roadmap.parseEffort(opts.effort) > 2) warnings.push(`${opts.effort} is large; consider splitting into steps under 2h.`);
  return { text: join(doc), warnings, id };
}

/** Parse "Name:30m" / "Name=1h". */
function part(raw) {
  const m = /^(.*?)\s*[:=]\s*(\d+(?:[.,]\d+)?\s*(?:m|min|h)?)\s*$/i.exec(String(raw).trim());
  return m ? { name: m[1].trim(), effort: m[2].replace(/\s+/g, '') } : { name: String(raw).trim(), effort: '' };
}

/** Replace a task with ordered subtasks; dependents move to the last subtask. */
function splitTask(text, id, parts, now = Date.now()) {
  if (!parts || parts.length < 2) throw new Error('Give at least two parts: visual-roadmap split T005 "Parte A:30m" "Parte B:45m"');
  const doc = split(text);
  const { lines } = doc;
  const taskId = String(id).toUpperCase();
  const row = need(lines, taskId);
  const status = Roadmap.normStatus(getField(row, 'status'));
  if (status === 'done' || status === 'cancelled') throw new Error(`${taskId} is ${status}; nothing to split`);
  const releaseTitle = releases(lines).find(r => r.line < row.line && row.line < r.end)?.title;
  const deps = getField(row, 'depends');
  const ids = [];
  let after = taskId, prevDep = blank(deps) ? '' : deps;
  for (const raw of parts) {
    const p = part(raw);
    const newId = insertTask(lines, join(doc), p.name, { release: releaseTitle, effort: p.effort, depends: prevDep, after });
    ids.push(newId); after = newId; prevDep = newId;
  }
  const original = findRow(lines, taskId);
  setField(lines, original, 'status', 'Estado', 'cancelled');
  setField(lines, original, 'note', 'Nota', `→ ${ids[0]}–${ids[ids.length - 1]}`);
  /* Whoever waited for the original now waits for the last part. */
  const depRe = new RegExp(`(^|[,;\\s])${taskId}(?=$|[,;\\s])`, 'i');
  forEachRow(lines, (i, header, cells) => {
    const idx = fieldIndex(header, 'depends');
    if (i === original.line || idx === -1 || !depRe.test(cells[idx] || '')) return;
    cells[idx] = cells[idx].replace(depRe, `$1${ids[ids.length - 1]}`);
    lines[i] = rowOf(cells);
  });
  let result = join(doc);
  const wasCurrent = status === 'active' || (nowTaskId(lines) || '').toUpperCase() === taskId;
  if (wasCurrent) result = start(result, ids[0], {}, now).text;
  else {
    const d = split(result);
    setMeta(d.lines, 'updated', stamp(now));
    result = join(d);
  }
  const d = split(result);
  logLine(d.lines, now, '✂', `${taskId} → ${ids.join(', ')}`);
  return { text: join(d), warnings: [], ids, started: wasCurrent ? ids[0] : null };
}

function readyTasks(doc) {
  const closed = new Set(doc.items.filter(i => i.status === 'done'));
  return doc.items.filter(i => i.status === 'planned' && i.depends.every(d => {
    const t = Roadmap.findTask(doc, d);
    return t && closed.has(t);
  }));
}

/** First ready task, preferring the release of the task just finished. */
function readyNext(text, afterId) {
  const doc = Roadmap.parse(text);
  const ready = readyTasks(doc);
  const prev = doc.items.find(i => (i.taskId || '').toUpperCase() === String(afterId || '').toUpperCase());
  const pick = (prev && ready.find(i => i.releaseId === prev.releaseId)) || ready[0];
  return pick ? pick.taskId : null;
}

/** Compact briefing: what an agent needs to resume work without reading the whole file. */
function status(text, now = Date.now(), lang = 'en') {
  const doc = Roadmap.parse(text);
  const f = Forecast.calculate(doc, now);
  const openItems = doc.items.filter(i => i.status !== 'done' && i.status !== 'cancelled');
  const ready = readyTasks(doc);
  return {
    title: doc.title,
    progress: doc.stats.pct,
    done: doc.stats.done,
    total: doc.stats.total,
    active: f.active ? {
      id: f.active.taskId, name: f.active.name, release: f.active.release,
      elapsedMinutes: f.elapsed, etaAt: f.eta != null ? stamp(f.eta) : null,
      overdue: f.overdue, remainingMinutes: f.activeRemaining, paused: f.active.status === 'paused'
    } : null,
    blocked: openItems.filter(i => i.status === 'blocked').map(i => ({ id: i.taskId, name: i.name })),
    next: ready.slice(0, 3).map(i => ({ id: i.taskId, name: i.name, effort: i.effortRaw, release: i.releaseId })),
    projectEta: f.projectEta != null ? stamp(f.projectEta) : null,
    issues: doc.issues.map(i => ({ level: i.level, code: i.code, text: Roadmap.formatIssue(i, lang) }))
  };
}

function check(text, lang = 'en') {
  const doc = Roadmap.parse(text);
  return doc.issues.map(i => ({ level: i.level, code: i.code, text: Roadmap.formatIssue(i, lang) }));
}

/** A few plain lines for hooks and session starts: enough to resume, cheap in tokens. */
function brief(text, now = Date.now(), lang = 'en') {
  const s = status(text, now, lang);
  const out = [`[visual-roadmap] ${s.title} · ${s.done}/${s.total} tasks · ${s.progress}%${s.total && s.projectEta ? ' · ETA ' + s.projectEta : ''}`];
  if (!s.total) {
    out.push('No tasks yet. Plan first: visual-roadmap add "Task" --effort 30m --release "v0.1 · Name" (see SKILL.md).');
    return out.join('\n');
  }
  if (s.active) {
    const a = s.active;
    out.push(`now: ${a.id} ${a.name} · ${a.elapsedMinutes ?? '?'}m worked${a.paused ? ' · PAUSED: resume ' + a.id : a.overdue ? ' · ETA PASSED: finish (done) or revise (eta ' + a.id + ' <remaining> "reason")' : a.remainingMinutes != null ? ' · ~' + a.remainingMinutes + 'm left' : ''}`);
  } else out.push('now: none. Pick one: visual-roadmap start <ID>');
  if (s.next.length) out.push('next: ' + s.next.map(n => `${n.id} ${n.name}${n.effort ? ' (' + n.effort + ')' : ''}`).join(' · '));
  if (s.blocked.length) out.push('blocked: ' + s.blocked.map(b => `${b.id} ${b.name}`).join(' · '));
  s.issues.filter(i => i.level === 'error').forEach(i => out.push('fix: ' + i.text));
  return out.join('\n');
}

module.exports = { start, done, block, pause, resume, progress, eta, note, add, split: splitTask, readyNext, status, brief, check, stamp, findRow };
