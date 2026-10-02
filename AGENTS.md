# AGENTS.md — working on the Visual Roadmap repository

This file is for agents that **change this repository**. To *use* Visual Roadmap in another project, read [SKILL.md](SKILL.md) (the protocol `init` installs) and the README Quick Start.

## Map

| Change | Edit | Then |
| --- | --- | --- |
| CLI command or flag | `bin/visual-roadmap.js` (argument parsing, output) and `lib/agent.js` (the text edit itself) | Document it in `SKILL.md`, `README.md` (Agent Commands) and the `help` text |
| How `ROADMAP.md` is edited | `lib/agent.js` — pure functions `text → { text, warnings }`, no I/O | `test/agent.test.js` |
| How `ROADMAP.md` is read | `viewer/md.js` (parser shared by the viewer and the CLI) | `docs/ROADMAP_FORMAT.md` |
| Viewer UI | `viewer/*.js`, `viewer/viewer.css`, `viewer/ui.js` (strings in English **and** Spanish) | `npm run build` — `dist/roadmap.html` is committed and CI fails if it is stale |
| Forecasts and ETAs | `viewer/forecast.js` | `test/forecast.test.js` |
| Local server, SSE, screenshots | `lib/server.js`, `lib/shots.js`, `lib/shot-hook.js` | `test/live.test.js`, `test/shots*.test.js` |
| Claude Code hooks | `cmdHook` / `cmdHooks` in `bin/visual-roadmap.js`, `lib/shot-hook.js` | `test/shot-hook.test.js` |

## Rules

- **Zero runtime dependencies.** Node 18+ built-ins only; the viewer is plain browser JS loaded as globals (`window.Roadmap`, `window.Timeline`…).
- **Agent commands answer in one line** and never print ANSI colors when piped. Agents pay for every token of output.
- **Never rewrite the whole file.** Edits keep column order, CRLF line endings, unknown columns and prose intact.
- **The viewer derives time.** Elapsed time, ETAs and overdue state are computed in the browser; commands only record events.
- **Tests first** for behavior changes: `node:test`, no frameworks. Viewer modules are testable in Node when they guard `window` (`typeof window !== 'undefined' ? window : globalThis`).
- Record user-visible changes under `## [Unreleased]` in `CHANGELOG.md`.

## Commands

```bash
npm test              # full suite, must stay green
npm run build         # regenerate dist/roadmap.html after any viewer/ change
npm run demo          # watch a scripted agent session in the live viewer (temp project, nothing in the repo changes)
npm start             # serve examples/VOIDFRONT.md on http://127.0.0.1:3579
npm run screenshots   # regenerate README images (needs Edge or Chrome)
```

`npm run demo` is the visual check: it drives the real CLI (`add --group`, `start`, `progress`, `eta`, `block`, `done --next`, `split`) step by step while the viewer updates. Use `--step 1.5` to go faster and `--no-open` to skip launching the browser.

## Layout

```
bin/        CLI entry point
lib/        Node-side logic: agent edits, git facts, server, screenshots
viewer/     Browser sources (bundled into dist/roadmap.html by scripts/build.js)
templates/  ROADMAP.md seed used by init
scripts/    build · screenshots · simulate (demo)
docs/       ROADMAP_FORMAT · DEVELOPMENT · design/ (specs and plans) · proposals/ (not implemented)
examples/   Fictional demo roadmap
test/       node:test suite
```
