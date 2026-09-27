/* viewer/shots.js — screenshots attached to tasks (served by visual-roadmap live).
   Loads /shots, refreshes on the SSE "shots" event and compresses new images
   to WebP in the background so the folder stays small. */
(function (global) {
  'use strict';
  let entries = [];
  const failed = new Set();
  let queue = Promise.resolve();
  const api = { available: false };

  const served = () => /^https?:$/.test(location.protocol);
  api.url = entry => `/shots/file/${entry.file.split('/').map(encodeURIComponent).join('/')}`;
  api.forTask = id => entries.filter(s => s.task === String(id || '').toUpperCase());
  api.coverFor = id => {
    const own = api.forTask(id);
    const finals = own.filter(s => s.kind === 'final');
    return (finals.length ? finals : own).at(-1) || null;
  };

  async function load() {
    if (!served()) return;
    try {
      const res = await fetch('/shots', { cache: 'no-store' });
      if (!res.ok) return;
      entries = ((await res.json()).shots || []).sort((a, b) => a.at.localeCompare(b.at));
      api.available = true;
      document.dispatchEvent(new CustomEvent('roadmap:shots-updated'));
      entries.filter(s => !s.compressed && !failed.has(s.id)).forEach(s => { queue = queue.then(() => compress(s)); });
    } catch {}
  }

  function idle() { return new Promise(r => (global.requestIdleCallback || setTimeout)(r)); }

  async function compress(entry) {
    await idle();
    try {
      const img = new Image();
      img.src = api.url(entry);
      await img.decode();
      const scale = Math.min(1, 1600 / img.naturalWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.8));
      if (!blob || blob.type !== 'image/webp') throw new Error('no webp');
      const res = await fetch(`/shots/${entry.id}`, { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: blob });
      if (!res.ok) throw new Error(String(res.status));
    } catch { failed.add(entry.id); }
  }

  api.init = () => {
    load();
    document.addEventListener('roadmap:shots', load);
  };
  global.RoadmapShots = api;
})(typeof window !== 'undefined' ? window : globalThis);
