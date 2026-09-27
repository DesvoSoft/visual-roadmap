# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Agent commands: `status`, `check`, `add`, `split`, `start`, `progress`, `eta`, `done [--next]`, `block` and `log`, with one-line output.
- `done` records the real duration and the lines changed from git; `--next` starts the next ready task.
- `init` installs the agent protocol (a Claude Code skill or `SKILL.md`), a short block in `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` / `.cursorrules` / Copilot instructions, and Claude Code hooks.
- Roadmap health panel with bilingual warnings that link to the task.
- Minute-precision task times, dependency-aware forecast with `capacity` parallel lanes.
- Git-aware header and task detail, desktop notifications, live tab title, shareable `?view=&theme=&lang=` links.
- README with logo and screenshots, `npm run screenshots`, CI on Linux and Windows (Node 18, 20, 22).

### Changed
- Repository layout: `bin/`, `lib/`, `scripts/` and `templates/`.
- `SKILL.md` rewritten around the work loop and how to split tasks.

### Fixed
- Dependencies written as task IDs (`T001`) were always reported missing.
- Timeline ticks now align to round hours and days; the light theme has better contrast.

## [0.1.0] - 2026-09-27

### Added
- Live viewer for `ROADMAP.md` with tracking, versions and notes views.
- Local server with SSE updates and a portable single-file `roadmap.html`.
- `init`, `live`, `serve`, `open` and `skill` commands.

[Unreleased]: https://github.com/DesvoSoft/visual-roadmap/compare/a98c45a...HEAD
[0.1.0]: https://github.com/DesvoSoft/visual-roadmap/commit/a98c45a
