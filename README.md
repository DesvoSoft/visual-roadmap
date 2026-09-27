<!-- markdownlint-disable MD033 MD041 -->
<h1 align="center">Visual Roadmap</h1>

<p align="center">A live roadmap for vibecoding: your coding agent plans in small tasks and reports progress, and you watch it in the browser.</p>

<p align="center">
  <img src="assets/logo.svg" alt="Visual Roadmap logo" width="120"/>
</p>

<p align="center">
  <img alt="Node.js 18+" src="https://img.shields.io/badge/node-18+-3c873a.svg?logo=node.js&logoColor=white" />
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg" />
  <img alt="Zero dependencies" src="https://img.shields.io/badge/dependencies-0-brightgreen.svg" />
  <img alt="Works with Claude Code, Codex, Cursor and Gemini" src="https://img.shields.io/badge/works_with-Claude_Code_·_Codex_·_Cursor_·_Gemini-7c5cff.svg" />
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#agent-commands">Agent Commands</a> •
  <a href="#documentation">Documentation</a>
</p>

---

## About

When an AI agent writes your code, it is hard to tell what it is doing, how far along it is and whether it is stuck. Visual Roadmap keeps a plain `ROADMAP.md` in your repository and a local viewer that updates as soon as the file changes.

The agent does very little extra work. It splits each request into small, verifiable tasks and runs a one-line command at each change of state: `start`, `done`, `block`, `eta`. The tool does the rest: timestamps, real durations, lines changed from git, the next ready task, ETAs and consistency checks.

There are no accounts and no services. The roadmap is a Markdown file you own, and the viewer is a single HTML file that runs locally.

---

## Preview

<p align="center">
  <img width="900" alt="Tracking view: current task with ETA, project forecast, recent changes and the timeline" src="assets/screenshots/tracking.png" />
</p>

<p align="center">
  <img width="445" alt="Versions view with deliverables per release" src="assets/screenshots/versions.png" />
  <img width="445" alt="Tracking view in the light theme" src="assets/screenshots/tracking-light.png" />
</p>

---

## Features

- **Plans in small tasks** — The bundled skill teaches the agent to turn every request into verifiable 15–90 minute tasks grouped into usable releases. `add` and `split` create them without the agent touching Markdown tables.
- **One command per state change** — `done T004 --next` records the end time, the real duration and the lines changed (from git), then starts the next ready task. Output is a single line with no ANSI colors when piped, so it costs the agent almost no tokens.
- **Automatic with Claude Code** — A `SessionStart` hook gives the agent a 4-line brief (current task, next tasks, anything to fix). A `Stop` hook warns it once when the roadmap has errors, an ETA has passed, or code changed with no active task.
- **Live viewer** — Current task with elapsed time and ETA, revisions with their reasons, project forecast with a confidence window, and a timeline. The tab title reads `▶ T004 · 23 min` even when the tab is in the background.
- **Roadmap health** — Catches missing or cancelled dependencies, several active tasks, stale ETAs, tasks without an effort estimate and tasks too big to verify. Click a warning to open the task.
- **Honest forecasts** — Projections respect dependencies, run independent work in parallel lanes (`capacity`) and are calibrated with the real durations of finished tasks.
- **Git-aware** — The last commit shows in the header, and commits that mention a task ID (`T004: …`) are listed in that task's detail.
- **Desktop notifications** — Optional alerts when a task finishes or gets blocked, when an ETA stalls and when the roadmap is complete. They only fire when you are not looking at the tab.

*Also included: a Versions view with filters and search, English and Spanish UI, dark and light themes, shareable view links (`?view=board&theme=light&lang=es`), and a portable `roadmap.html` that also works without a server.*

---

## Quick Start

### Requirements

- **Node.js 18+**
- A Git repository (optional; it enables commit links and line counts)

### 1. Install and initialize

In the project you want to track:

```bash
npm install --save-dev git+https://github.com/DesvoSoft/visual-roadmap.git
npx visual-roadmap init --project "My App"
```

`init` never overwrites existing files unless you pass `--force`. It creates `ROADMAP.md` and `roadmap.html`, and sets up the agent:

| Your setup | What `init` installs |
| --- | --- |
| **Claude Code** (`CLAUDE.md` or `.claude/` present) | Skill in `.claude/skills/visual-roadmap/` (loaded only when relevant) and hooks in `.claude/settings.json` |
| **Other agents** (Codex, Cursor, Gemini, Copilot…) | `SKILL.md` at the root, or in `.visual-roadmap/` if that name is taken |
| **Every setup** | A 4-line block in `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.cursorrules` or `.github/copilot-instructions.md` (whichever exist; otherwise it creates `AGENTS.md`) |

Skip parts with `--no-agents` or `--no-hooks`.

### 2. Open the live viewer

```bash
npx visual-roadmap live
```

The viewer opens at `http://127.0.0.1:3579` and updates whenever `ROADMAP.md` changes. If the port is taken, use `--port 3580`.

### 3. Ask your agent

> Follow the visual-roadmap protocol. Split what is left in this project into releases and verifiable tasks with `npx visual-roadmap add`, then work task by task.

After that, every new request is split and tracked the same way. You do not have to repeat the instruction.

> **Working from a local clone?** Run `node path/to/visual-roadmap/cli.js init` in your project, then `node path/to/visual-roadmap/cli.js live`. The package is not on npm yet.

---

## Agent Commands

All commands edit the nearest `ROADMAP.md` up to the repository root (or `--file`) and answer in one line.

| When | Command |
| --- | --- |
| Resume a session | `visual-roadmap status [--json]` |
| Plan a task | `visual-roadmap add "Result" --effort 30m [--release "v0.2 · Name"] [--after T003]` |
| A task grew too big | `visual-roadmap split T005 "Part A:30m" "Part B:45m"` |
| Start working | `visual-roadmap start T004 [--expected 40m]` |
| Verified progress | `visual-roadmap progress T004 60` |
| The ETA no longer holds | `visual-roadmap eta T004 25m "reason"` |
| Finish | `visual-roadmap done T004 --note "evidence" [--next]` |
| Blocked | `visual-roadmap block T004 "cause"` |
| Decision or note | `visual-roadmap log "text"` |
| After editing by hand | `visual-roadmap check [--json] [--strict]` |

A typical session looks like this:

```text
$ npx visual-roadmap add "Search filters recipes by ingredient" --effort 40m --release "v0.1 · Browse"
✓  T002 added
$ npx visual-roadmap start T002
✓  T002 started
$ npx visual-roadmap done T002 --note "6 search tests green" --next
✓  T002 done · real 48m · +142 -30 · now T003
```

### Viewer and setup commands

| Command | Purpose |
| --- | --- |
| `visual-roadmap init --project "Name"` | Create the roadmap, the viewer and the agent setup. |
| `visual-roadmap live [--port 3579]` | Serve the viewer, watch `ROADMAP.md` and open the browser. |
| `visual-roadmap serve --file path/ROADMAP.md` | Serve without opening the browser. |
| `visual-roadmap open` | Open the portable `roadmap.html`. |
| `visual-roadmap agents [--install]` | Print or install the block for `CLAUDE.md` / `AGENTS.md`. |
| `visual-roadmap hooks [--install]` | Print or install the Claude Code hooks. |

---

## How It Works

```text
  agent ── visual-roadmap start/done/eta ──►  ROADMAP.md  ──(watch + SSE)──►  viewer
    ▲                                              │
    └──── SessionStart brief · Stop check ◄────────┘   (Claude Code hooks)
```

- **`ROADMAP.md`** is the only source of truth: YAML frontmatter plus one Markdown table per release. It stays readable and editable by hand.
- **The agent commands** make deterministic text edits. They keep the table columns, CRLF line endings and the rest of the file intact.
- **The viewer** derives everything that changes over time (elapsed time, ETAs, overdue state, projections) on its own, so the agent never writes just because time passed.

---

## Project Structure

```
visual-roadmap/
├── cli.js              # Commands: init, live, agent commands, hooks
├── agent.js            # Deterministic ROADMAP.md edits (pure text → text)
├── git.js              # Read-only git facts: commits per task, lines changed
├── server.js           # Local server: viewer, SSE updates, /git
├── build.js            # Bundles viewer/ into dist/roadmap.html
├── viewer/             # Parser, forecast, views, styles, i18n
├── dist/roadmap.html   # Portable single-file viewer (committed)
├── SKILL.md            # Agent protocol installed into projects
├── ROADMAP.seed.md     # Template used by init
├── docs/               # Format and development guides
├── tools/              # Screenshot generator for this README
└── test/               # node:test suite
```

---

## Documentation

- **[SKILL.md](SKILL.md)** — Agent protocol: how to split work, which command to run and when *(Spanish)*.
- **[docs/ROADMAP_FORMAT.md](docs/ROADMAP_FORMAT.md)** — The `ROADMAP.md` format and its rules *(Spanish)*.
- **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** — Repository layout and local workflow *(Spanish)*.
- **[examples/VOIDFRONT.md](examples/VOIDFRONT.md)** — A larger fictional roadmap (`npm start` opens it).

### Development

```bash
npm test               # node:test suite
npm run build          # rebuild dist/roadmap.html after editing viewer/
npm start              # serve the demo roadmap
npm run screenshots    # regenerate the README screenshots (needs Edge or Chrome)
```

---

## License

**Visual Roadmap** © 2026 by **DesvoSoft**. Released under the **[MIT License](LICENSE)**.

---

## Support

Found a bug or have an idea? [Open an issue](https://github.com/DesvoSoft/visual-roadmap/issues). Pull requests are welcome.

---

<p align="center"><b>Built for people who build with agents</b></p>
