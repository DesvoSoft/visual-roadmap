/* lib/shot-hook.js — find the screenshot in a Claude Code PostToolUse payload.
   MCP tools return images as content blocks ({type:'image', data, mimeType} or
   {source:{type:'base64', media_type, data}}); Read points at a file. */

'use strict';

const fs = require('fs');
const path = require('path');

const IMAGE = /\.(png|jpe?g|webp)$/i;
const SKIP = /(^|[\\/])(assets|node_modules|dist|\.roadmap)([\\/]|$)/;
const FRESH_MS = 10 * 60000;

function findImage(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 6) return null;
  if (Array.isArray(value)) {
    for (const v of value) { const found = findImage(v, depth + 1); if (found) return found; }
    return null;
  }
  const mime = value.mimeType || value.media_type || value.mediaType || value.source?.media_type || '';
  const data = typeof value.data === 'string' ? value.data : typeof value.source?.data === 'string' ? value.source.data : null;
  if (data && /^image\//.test(mime)) return Buffer.from(data, 'base64');
  for (const v of Object.values(value)) { const found = findImage(v, depth + 1); if (found) return found; }
  return null;
}

function findText(value, depth = 0) {
  if (!value || depth > 4) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(v => findText(v, depth + 1)).find(Boolean) || '';
  if (typeof value === 'object') return value.type === 'text' && typeof value.text === 'string' ? value.text : findText(value.content, depth + 1);
  return '';
}

function fromPayload(input, { cwd = process.cwd(), now = Date.now() } = {}) {
  const name = String(input?.tool_name || '');
  const args = input?.tool_input || {};
  if (/screenshot/i.test(name) || (/computer/i.test(name) && args.action === 'screenshot')) {
    const source = /chrome/i.test(name) ? 'hook:chrome' : /playwright/i.test(name) ? 'hook:playwright' : 'hook:mcp';
    const file = args.filename || args.path || args.filePath;
    const url = (findText(input.tool_response).match(/https?:\/\/\S+/) || [])[0];
    const caption = args.url || url || args.title || (file ? path.basename(file) : '') || name.replace(/^mcp__/, '');
    const buffer = findImage(input.tool_response);
    if (buffer) return { buffer, caption, source };
    if (file) {
      const full = path.resolve(cwd, file);
      if (IMAGE.test(full) && fs.existsSync(full)) return { file: full, caption, source };
    }
    return null;
  }
  if (name === 'Read' && IMAGE.test(String(args.file_path || ''))) {
    const full = path.resolve(cwd, args.file_path);
    if (SKIP.test(path.relative(cwd, full))) return null;
    try { if (now - fs.statSync(full).mtimeMs > FRESH_MS) return null; } catch { return null; }
    return { file: full, caption: path.basename(full), source: 'hook:read' };
  }
  return null;
}

module.exports = { fromPayload, findImage };
