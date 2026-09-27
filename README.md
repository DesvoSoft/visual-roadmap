<!-- markdownlint-disable-next-line MD033 -->
<h1 align="center">Visual Roadmap</h1>

<!-- markdownlint-disable-next-line MD033 -->
<p align="center">Live Sci-Fi Mission Control & Progress Tracker HUD for Autonomous AI Sessions</p>

<!-- markdownlint-disable-next-line MD033 -->
<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg" />
  <img alt="Zero-Dependency" src="https://img.shields.io/badge/Zero--Dependency-Portable_HTML-brightgreen" />
  <img alt="Node.js 18+" src="https://img.shields.io/badge/node-%3E%3D18-blue.svg" />
  <img alt="AI Agnostic" src="https://img.shields.io/badge/AI_Agnostic-Claude_%7C_Codex_%7C_Antigravity_%7C_OpenCode-orange" />
  <img alt="UI: Sci-Fi HUD" src="https://img.shields.io/badge/UI-Sci--Fi_HUD-cyan" />
</p>

<!-- markdownlint-disable-next-line MD033 -->
<p align="center">
  <a href="#about">About</a> •
  <a href="#mission-control-hud">Mission Control HUD</a> •
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#canonical-roadmap-format">Roadmap Standard</a> •
  <a href="#license">License</a>
</p>

---

## About

When developers and teams launch **long autonomous AI coding sessions** (using tools like Claude Code, Antigravity, OpenCode, Cursor, Codex, or Aider), two major problems arise:

1. **Information Overload:** The AI spits out hundreds of lines of terminal logs, reasoning steps, and tool calls. Developers lose track of the big picture.
2. **Lack of Live Visibility:** The user has no easy way to know *what specific task the agent is working on right now*, how long it has taken, what is finished, and when the milestone will realistically be completed.

**Visual Roadmap** solves this by establishing a **lightweight protocol + live visual Mission Control**:
- The AI maintains a single canonical **`ROADMAP.md`** file in silence as it works.
- The user opens a sleek, **100% local, zero-dependency browser HUD** that automatically refreshes in real-time.
- No cloud dependencies, no third-party tracking, and zero disruptions.

---

## Mission Control HUD

Inspired by technical game-studio progress trackers (such as Star Citizen's RSI Progress Tracker and aerospace telemetry displays), the UI consolidates live intelligence into a unified command dashboard:

```
┌──────┬────────────────────────────────────────────────────────────────────────┐
│ RAIL │ [MY_PROJECT · HOJA DE RUTA]  [● EN VIVO]       [Actualizado hace 1 min]│
│      │ SEGUIMIENTO DEL PROGRESO                                               │
│ ═    │ Versión 0.1 · Fase 11 de 14 · 75/92 tareas · 397 tests · último commit │
│ [📈] │┌──────────────────┬──────────────────┬────────────────────────────────┐│
│ SEGU ││ AHORA MISMO      │ MY_PROJECT 0.1   │ ÚLTIMOS CAMBIOS                ││
│      ││ T109 World Props │ 82 % (75 de 92)  │ 01:15 ✓ Cairn mesh  +1163 -251 ││
│ [▦]  ││ [BARRA ÁMBAR]    │ [BARRA CIAN]     │ 23:55 📄 tools:...    +29 -2   ││
│ VERS ││ Esperado: 01:15  │ Ritmo: 39.8 min  │ 23:51 ✓ Kit luz...  +1175 -42  ││
│      ││ Lleva: 49 min    │ Est: 27 sept...  │ 22:43 ✓ Asteroids   +751 -84   ││
│ [📄] │└──────────────────┴──────────────────┴────────────────────────────────┘│
│ NOTAS│ [EQUIPOS] [ENTREGABLES]  |  [Buscar...] [6H][1 DÍA][3D][1S] [<][AHORA][>]│
│      │ VERSIÓN · HECHAS  |  10:00  12:00  14:00  16:00  [ AHORA ]  04:00 ...   │
│      │ ⌵ FASE 11 (9/12)  |  ═══════════════════════════════│═════════════════  │
│      │ ■ T106 Asteroids  |  [===== 48 min =====]           │                   │
│      │ ■ T109 Props      |                                 │/// desde 01:15 ///│
│      │ □ T110 PostFX     |                                 │   [ est. 02:35 ]  │
└──────┴─────────────────────────────────────────────────────▼──────────────────┘
```

---

## Features

- **Live AI Activity Card ("AHORA MISMO")** — Real-time telemetry on the current active task (`T109`), elapsed time, expected duration, and dynamic delay alerts (`tarda más de lo previsto`).
- **Smart Cadence & Dynamic Predictions** — Derives the real team/agent cadence (e.g. `39.8 min per task`) and projects the exact completion timestamp based on empirical progress.
- **Collapsible Chronogram Timeline** — Deliverables timeline with multi-scale zoom (`6 H`, `1 DÍA`, `3 DÍAS`, `1 SEMANA`, `1 MES`), an active orange `AHORA` indicator line, and calculated start times for future tasks (`est. 02:35`).
- **Release Kanban Board ("VERSIONES")** — Columnar board with task cards, priority indicators (`P0`–`P3`), effort badges, and owner avatars.
- **Activity & Diff Stream ("ÚLTIMOS CAMBIOS")** — Real-time commit feed with delta badges (`+1163 -251`) so you see what changed without browsing git logs.
- **100% Local & Air-Gapped** — Everything is parsed directly from your workspace. No data ever leaves your machine, keeping proprietary architecture, client details, and roadmaps strictly private.
- **Zero-Dependency Portable HTML** — Bundles everything into a single, self-contained `roadmap.html` file (113 KB). Double-click to open in any modern browser.
- **Live File Watcher** — Uses the native **File System Access API** with smart fallback to polling, local SSE stream, and drag-and-drop.
- **AI Agent Skill Included (`SKILL.md`)** — Plug-and-play instruction manual teaching any agent how to maintain and format the roadmap autonomously.

---

## Quick Start

### Option A: Portable Standalone Viewer (Recommended)

1. Copy [`dist/roadmap.html`](dist/roadmap.html) into your project root.
2. Double-click `roadmap.html` in Chrome or Edge.
3. Click **📂 Abrir** and select your local `ROADMAP.md`.
4. The viewer will auto-refresh whenever your AI agent updates the file.

### Option B: Using the CLI

Run the zero-install CLI in any repository:

```bash
# Initialize ROADMAP.md + standalone roadmap.html + SKILL.md
npx visual-roadmap init --project "My App" --owner "desvosoft"

# Start the local SSE server for live updates without File System API prompts
npx visual-roadmap serve --port 3579

# Launch the viewer directly in your browser
npx visual-roadmap open
```

---

## Canonical Roadmap Format

To ensure consistent output across different AI models, agents must format `ROADMAP.md` according to the canonical standard documented in [`SKILL.md`](SKILL.md):

```markdown
---
title: MY_PROJECT
subtitle: HOJA DE RUTA
owner: DesvoSoft
started: 2026-09-25 17:17
updated: 2026-09-26 22:15
timezone: America/Mexico_City
week_start: mon
capacity: 1
version: "0.1"
phase: 11
phase_total: 14
tests: 397
e2e: 37
decisions: 92
lines: 29421
last_commit: "335e3ea"
last_commit_time: "hace 49 min"
now_task:
  id: "T109"
  name: "Props del mundo"
  context: "Fase 11 · Resto de assets · Arte procedural"
  expected: "01:15"
  elapsed: "49 min"
  status: "tarda más de lo previsto"
---

## Últimos cambios

- 01:15 | ✓ | Cairn props y collision meshes | +1163 -251
- 23:55 | 📄 | tools: pipeline de exportación | +29 -2
- 23:51 | ✓ | Kit de iluminación volumétrica | +1175 -42

## Releases

### Fase 11 · Resto de assets
`2026-09-25 → 2026-09-28` · **active** · 82%

#### Arte procedural y combate

| Item | Estado | Progreso | Owner | Esfuerzo | Inicio | Fin | Depende | Prio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T041 Proyectiles y armas | done | 100% | @desvosoft | 6h | 2026-09-25 | 2026-09-25 | — | P0 |
| T042 Escudos y daño por pieza | done | 100% | @desvosoft | 8h | 2026-09-25 | 2026-09-26 | T041 | P0 |
| T109 Props del mundo | active | 65% | @desvosoft | 8h | 2026-09-26 | 2026-09-27 | — | P0 |
| T110 Shaders de atmósfera | planned | 0% | @desvosoft | 6h | 2026-09-27 | 2026-09-28 | T109 | P1 |
```

---

## Architecture & Project Structure

```
visual-roadmap/
├── dist/
│   └── roadmap.html         # Single-file standalone build (zero dependencies)
├── viewer/                  # Modular source code
│   ├── index.html           # HUD Shell layout
│   ├── tokens.css           # Sci-Fi design tokens & color variables
│   ├── viewer.css           # Mission Control & Chronogram styles
│   ├── md.js                # Resilient Markdown parser & realism engine
│   ├── watcher.js           # File System Access API & SSE watcher
│   ├── timeline.js          # Deliverables timeline & chronogram
│   ├── board.js             # Kanban board view
│   ├── log.js               # Activity log renderer
│   └── app.js               # Controller & telemetry binding
├── cli.js                   # CLI entry point (init, serve, open)
├── server.js                # Local SSE broadcast server
├── build.js                 # Standalone compiler/bundler
├── SKILL.md                 # Universal prompt/skill for AI agents
├── ROADMAP.seed.md          # Canonical starter template
└── ROADMAP.md               # Live project roadmap
```

---

## Building the Standalone Viewer

To recompile `viewer/` into `dist/roadmap.html`:

```bash
npm run build
# Or: node build.js
```

---

## Author & License

Developed with precision by **DesvoSoft** (`desvox23@gmail.com`).

Licensed under the **MIT License**. See [LICENSE](LICENSE) for details.
