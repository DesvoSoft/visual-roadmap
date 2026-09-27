/* lib/server.js — SSE server for live ROADMAP.md updates
   Used by  visual-roadmap serve  or  require('visual-roadmap/lib/server.js').serve()
   
   Viewer URL: http://127.0.0.1:3579/
   
   Protocol:
   - GET /sse        → text/event-stream with "roadmap" events
   - GET /ping       → 200 OK (health check)
   - GET /content    → current ROADMAP.md as JSON { content }
   - GET /git        → recent commits { commits: [{hash,time,subject,tasks,add,del}] }
   - OPTIONS *       → CORS preflight
*/

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

function serve({ file, port = 3579 } = {}) {
  file = path.resolve(file || 'ROADMAP.md');

  if (!fs.existsSync(file)) {
    throw new Error(`ROADMAP file not found: ${file}`);
  }

  /* ── State ─────────────────────────────────────────── */

  const clients = new Set();
  let lastContent = '';
  let lastMtime   = 0;
  let gitCache    = null;

  function readFile() {
    try { return fs.readFileSync(file, 'utf8'); }
    catch { return null; }
  }

  function broadcast(content) {
    gitCache = null;   /* a roadmap change usually follows a commit */
    const payload = `event: roadmap\ndata: ${JSON.stringify(content)}\n\n`;
    for (const res of clients) {
      try { res.write(payload); }
      catch { clients.delete(res); }
    }
  }

  /* Initial read */
  lastContent = readFile() || '';

  /* ── Watch ──────────────────────────────────────────── */

  const watcher = fs.watch(file, { persistent: true }, () => {
    try {
      const stat = fs.statSync(file);
      if (stat.mtimeMs === lastMtime) return;
      lastMtime = stat.mtimeMs;
      const content = readFile();
      if (content === null || content === lastContent) return;
      lastContent = content;
      broadcast(content);
    } catch {}
  });

  /* Fallback poll (some editors do atomic saves that fool fs.watch) */
  const poll = setInterval(() => {
    try {
      const stat = fs.statSync(file);
      if (stat.mtimeMs === lastMtime) return;
      lastMtime = stat.mtimeMs;
      const content = readFile();
      if (content === null || content === lastContent) return;
      lastContent = content;
      broadcast(content);
    } catch {}
  }, 1500);

  /* ── HTTP server ────────────────────────────────────── */

  const server = http.createServer((req, res) => {
    const allowedOrigins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
    if ((req.headers.origin && !allowedOrigins.has(req.headers.origin)) ||
        (req.headers.host && !new Set([`127.0.0.1:${port}`, `localhost:${port}`]).has(req.headers.host))) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url, `http://localhost:${port}`);

    if (url.pathname === '/' || url.pathname === '/roadmap.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      fs.createReadStream(path.join(__dirname, '..', 'dist', 'roadmap.html')).pipe(res);
      return;
    }

    /* SSE endpoint */
    if (url.pathname === '/sse') {
      res.writeHead(200, {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection':    'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      res.write(':ok\n\n');

      /* Send current content immediately */
      res.write(`event: roadmap\ndata: ${JSON.stringify(lastContent)}\n\n`);

      clients.add(res);

      /* Heartbeat every 25 s to keep connection alive through proxies */
      const hb = setInterval(() => {
        try { res.write(':ping\n\n'); }
        catch { clearInterval(hb); clients.delete(res); }
      }, 25000);

      req.on('close', () => {
        clearInterval(hb);
        clients.delete(res);
      });

      return;
    }

    /* Health check */
    if (url.pathname === '/ping') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('pong');
      return;
    }

    /* Recent commits (task IDs in subjects link them to tasks); cached briefly */
    if (url.pathname === '/git') {
      if (!gitCache || Date.now() - gitCache.at > 10000) {
        gitCache = { at: Date.now(), commits: require('./git.js').recentCommits(path.dirname(file), 60) };
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ commits: gitCache.commits }));
      return;
    }

    /* Current content as JSON */
    if (url.pathname === '/content') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ content: lastContent, file, clients: clients.size }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\x1b[31m✗\x1b[0m  Port ${port} already in use. Try  --port ${port + 1}`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(port, '127.0.0.1', () => {
    const sseUrl = `http://localhost:${port}/sse`;
    console.log('');
    console.log('\x1b[33m  ╔═══════════════════════════════════════════════╗\x1b[0m');
    console.log('\x1b[33m  ║   Visual Roadmap — SSE Server                 ║\x1b[0m');
    console.log('\x1b[33m  ╚═══════════════════════════════════════════════╝\x1b[0m');
    console.log('');
    console.log(`\x1b[32m  ✓\x1b[0m  Watching: \x1b[1m${file}\x1b[0m`);
    console.log(`\x1b[32m  ✓\x1b[0m  SSE at:   \x1b[1m${sseUrl}\x1b[0m`);
    console.log(`\x1b[32m  ✓\x1b[0m  Viewer:   \x1b[1mhttp://127.0.0.1:${port}/\x1b[0m`);
    console.log('');
    console.log('  Open the viewer URL above; updates connect automatically.');
    console.log('  \x1b[2mCtrl+C to stop\x1b[0m');
    console.log('');
  });

  /* Graceful shutdown */
  function shutdown() {
    clearInterval(poll);
    watcher.close();
    for (const res of clients) { try { res.end(); } catch {} }
    server.close(() => process.exit(0));
  }

  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}

module.exports = { serve };
