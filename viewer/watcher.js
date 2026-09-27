/* watcher.js — Live file watcher for ROADMAP.md
   Estrategia de acceso (en orden):
   1. File System Access API + polling (Chrome/Edge, local)
   2. Drag & drop sobre la zona de drop
   3. SSE desde servidor local (?sse=1 en la URL)
   4. Paste manual (Ctrl+V sobre la app)  */

(function (global) {
  'use strict';

  const POLL_MS = 2000;

  let _handle    = null;  /* FileSystemFileHandle */
  let _lastMtime = 0;
  let _lastText  = null;
  let _timer     = null;
  let _fileName  = null;

  /* ── event bus ──────────────────────────────────────── */

  function dispatch(content, source) {
    if (content === _lastText) return;
    _lastText = content;
    document.dispatchEvent(new CustomEvent('roadmap:update', {
      detail: { content, source, fileName: _fileName }
    }));
  }

  function dispatchFileOpen(name) {
    _fileName = name;
    document.dispatchEvent(new CustomEvent('roadmap:file-open', {
      detail: { name }
    }));
  }

  /* ── File System Access API ─────────────────────────── */

  async function _pollOnce() {
    if (!_handle) return;
    try {
      const file = await _handle.getFile();
      if (file.lastModified !== _lastMtime) {
        _lastMtime = file.lastModified;
        const text = await file.text();
        dispatch(text, 'fsa');
      }
    } catch (e) {
      console.warn('[Watcher] poll error', e);
    }
  }

  function _startPoll() {
    if (_timer) clearInterval(_timer);
    _timer = setInterval(_pollOnce, POLL_MS);
  }

  function stopPolling() {
    if (_timer) { clearInterval(_timer); _timer = null; }
  }

  /** Abre el picker de archivos y arranca el watcher */
  async function pickFile() {
    if (!window.showOpenFilePicker) {
      showFallbackHint();
      return false;
    }
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown'], 'text/plain': ['.md', '.txt'] } }],
        multiple: false
      });
      _handle    = handle;
      _lastMtime = 0;
      const file = await handle.getFile();
      _lastMtime = file.lastModified;
      const text = await file.text();
      dispatchFileOpen(handle.name);
      dispatch(text, 'fsa');
      _startPoll();
      return true;
    } catch (e) {
      if (e.name !== 'AbortError') console.error('[Watcher] pickFile', e);
      return false;
    }
  }

  /* ── Drag & drop ────────────────────────────────────── */

  function setupDragDrop(el) {
    el.addEventListener('dragenter', e => { e.preventDefault(); el.classList.add('drop-active'); });
    el.addEventListener('dragover',  e => { e.preventDefault(); el.classList.add('drop-active'); });
    el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('drop-active'); });
    el.addEventListener('drop', async e => {
      e.preventDefault();
      el.classList.remove('drop-active');
      stopPolling();
      const file = [...e.dataTransfer.files].find(f => /\.(md|markdown|txt)$/i.test(f.name));
      if (!file) return;
      const text = await file.text();
      dispatchFileOpen(file.name);
      dispatch(text, 'drop');
      /* Para drag&drop no hay handle, avisa que el live update no estará disponible */
      document.dispatchEvent(new CustomEvent('roadmap:no-live', { detail: { reason: 'drop' } }));
    });
  }

  /* ── SSE fallback ───────────────────────────────────── */

  let _sse = null;

  function setupSSE(url) {
    if (_sse) { _sse.close(); _sse = null; }
    _sse = new EventSource(url);
    _sse.addEventListener('roadmap', e => {
      dispatchFileOpen('roadmap (sse)');
      dispatch(e.data, 'sse');
    });
    _sse.addEventListener('error', () => {
      console.warn('[Watcher] SSE error, closing');
      _sse.close(); _sse = null;
    });
    return _sse;
  }

  /* ── Paste fallback ─────────────────────────────────── */

  function setupPaste() {
    document.addEventListener('paste', async e => {
      const text = e.clipboardData && e.clipboardData.getData('text/plain');
      if (!text || !text.includes('---')) return;  /* rudimentary ROADMAP check */
      e.preventDefault();
      dispatchFileOpen('clipboard');
      dispatch(text, 'paste');
      document.dispatchEvent(new CustomEvent('roadmap:no-live', { detail: { reason: 'paste' } }));
    });
  }

  /* ── hint ───────────────────────────────────────────── */

  function showFallbackHint() {
    document.dispatchEvent(new CustomEvent('roadmap:no-fsa'));
  }

  /* ── autoSSE: si la URL tiene ?sse=<endpoint> ─────── */

  (function autoSSE() {
    const p = new URLSearchParams(location.search);
    const ep = p.get('sse');
    if (ep) setupSSE(ep);
  })();

  /* ── API pública ─────────────────────────────────────── */

  global.Watcher = {
    pickFile,
    stopPolling,
    setupDragDrop,
    setupSSE,
    setupPaste,
    /** Inyectar contenido manualmente (útil para tests) */
    inject(text, name) {
      if (name) dispatchFileOpen(name);
      dispatch(text, 'manual');
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);
