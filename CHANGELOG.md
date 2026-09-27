# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Task screenshots: `shot` / `shots` commands and a Claude Code PostToolUse capture that keeps the agent's own screenshots on the active task.
- Screenshots stored in `.roadmap/shots/` (self-ignored by git), deduplicated, pruned per task and by `shots_max_mb`, and compressed to WebP by the viewer.
- Timeline 📷 badge, cover preview on hover and capture marks; task detail activity log with thumbnails and a lightbox.
- Server: `GET /shots`, `GET /shots/file/*`, `POST /shots/:id` and an SSE `shots` event.

## [0.4.0] - 2026-09-27

### Added
- Collapsible overview: the tracking HUD folds into a single strip with the current task, its status and the version progress; the choice is remembered.
- Clickable timeline filters for pending, blocked, overdue and undated deliverables.
- Timeline labels that do not fit inside a bar are drawn next to it; projected bars show their dates in the tooltip.
- README: a copy-paste prompt so an agent can install and adopt the protocol, and a troubleshooting table.

### Changed
- Tracking layout gives the timeline most of the screen: one-line header, compact three-column overview, one-row toolbar and 30px rows.
- The current task bar is time based: cyan up to the expected time, orange for the overrun, with an `elapsed / expected` label and an on-track or `+N min` chip.
- ETA revisions merge into the recent-changes feed (four latest, the rest in Notes); the forecast note moves to the projected-delivery tooltip with a confidence chip.

### Fixed
- Filter chips were unreadable because buttons kept the browser's default text color.
- Bars no longer render mid-animation on first load, which also fixes the README screenshots.
- Light theme contrast for the revised ETA, the expected-time tick and the search box; long Spanish labels in the side rail.

## [0.3.0] - 2026-09-27

### Added
- `pause` and `resume` commands keep paused time out of actual work duration.
- Claude Code PostToolUse and UserPromptSubmit hooks automatically start the next ready task when code changed without an active task.
- Timeline slip labels, distinct paused and blocked styles, and a stronger active progress pulse.

### Changed
- Forecast and timeline move unfinished work past stale planned dates and reschedule dependent tasks after delays.
- Agent instructions make roadmap updates implicit during coding work.

## [0.2.0] - 2026-09-27

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

[Unreleased]: https://github.com/DesvoSoft/visual-roadmap/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/DesvoSoft/visual-roadmap/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/DesvoSoft/visual-roadmap/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/DesvoSoft/visual-roadmap/compare/a98c45a...v0.2.0
[0.1.0]: https://github.com/DesvoSoft/visual-roadmap/commit/a98c45a
