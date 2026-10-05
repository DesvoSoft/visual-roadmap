# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.6.0] - 2026-10-04

### Added
- Timeline: `3 H` zoom, with 30-minute ticks and capture marks.

### Changed
- `SKILL.md` is about 40% shorter and the snippet for `CLAUDE.md` / `AGENTS.md` drops to three bullets: same protocol, fewer tokens per session.
- The `PostToolUse` hook is installed with a matcher (tools that write code or return images) so it is not spawned after every tool call. Run `visual-roadmap hooks --install` to update an existing project.
- "Code changed with no active task" now means files written after the last roadmap change, instead of any uncommitted or recently committed diff: finishing the last task with uncommitted work no longer triggers the reminder or starts the next task.

### Fixed
- Timeline: the list no longer jumps back to the top when the roadmap or the screenshots update while you are scrolled down.
- The `PostToolUse` hook no longer feeds roadmap errors or a passed ETA back to the agent after every tool call; those wait for `Stop` and `UserPromptSubmit`.
- The viewer no longer repaints the timeline when a screenshot is only recompressed.

## [0.5.1] - 2026-10-03

### Fixed
- The `UserPromptSubmit` hook no longer blocks the user's prompt when code changed with no active task, the roadmap has errors or an ETA has passed: the reminder is added to the agent's context instead.
- Hooks never fail on an internal error (unreadable `ROADMAP.md`, git unavailable): they exit 0 silently. Only the `Stop` hook can hold the agent, once.

## [0.5.0] - 2026-10-02

### Added
- Task screenshots: `shot` / `shots` commands and a Claude Code PostToolUse capture that keeps the agent's own screenshots on the active task.
- Screenshots stored in `.roadmap/shots/` (self-ignored by git), deduplicated, pruned per task and by `shots_max_mb`, and compressed to WebP by the viewer.
- Timeline 📷 badge, cover preview on hover and capture marks; task detail activity log with thumbnails and a lightbox.
- Server: `GET /shots`, `GET /shots/file/*`, `POST /shots/:id` and an SSE `shots` event.
- Timeline: task code and full description live in a wide, resizable left column (`T109: Props del mundo`), with status, progress, slip and screenshot chips; the right side shows bars only.
- Timeline: `#### Subgroup` headings inside a release render as collapsible subgroups with their own progress bar.
- `add --group "Subgroup"` places a task under a `####` subgroup (creating it if needed); `--after` keeps the task in that row's subgroup.
- Timeline: the release of the active task opens by itself when the agent moves to another release.
- `npm run demo` (`scripts/simulate.js`): plays a scripted agent session through the real CLI in a temporary project while the viewer updates live.
- `AGENTS.md`: map of where each change goes and the rules, for agents working on this repository.

### Fixed
- `add` into a release with several tables no longer always lands in the first one; it defaults to the last table.
- Timeline: a cancelled task that never finished no longer draws a projected bar, and release/subgroup counts leave cancelled tasks out.

### Changed
- Design specs and plans moved to `docs/design/`; the Windows setup proposal to `docs/proposals/windows-setup.md`.

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

[Unreleased]: https://github.com/DesvoSoft/visual-roadmap/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/DesvoSoft/visual-roadmap/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/DesvoSoft/visual-roadmap/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/DesvoSoft/visual-roadmap/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/DesvoSoft/visual-roadmap/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/DesvoSoft/visual-roadmap/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/DesvoSoft/visual-roadmap/compare/a98c45a...v0.2.0
[0.1.0]: https://github.com/DesvoSoft/visual-roadmap/commit/a98c45a
