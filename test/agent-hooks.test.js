const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, '../bin/visual-roadmap.js');
const ROADMAP = '---\ntitle: Hooks\n---\n## Releases\n### v1 · Work\n| Item | Estado | Esfuerzo |\n| --- | --- | --- |\n| T001 Search filters | planned | 30m |\n| T002 Export to PDF | planned | 30m |\n';

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-roadmap-agents-'));
  fs.writeFileSync(path.join(dir, 'ROADMAP.md'), ROADMAP);
  spawnSync('git', ['init', '-q'], { cwd: dir });
  /* No CLAUDE_PROJECT_DIR: Cursor and Codex say where the project is in the payload */
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  const run = (args, input = '{}', cwd = dir) => spawnSync(process.execPath, [CLI, ...args], { cwd, input, encoding: 'utf8', env });
  return { dir, run };
}

test('init installs hooks for Codex and Cursor when the project uses them', () => {
  const { dir, run } = project();
  try {
    fs.mkdirSync(path.join(dir, '.codex'));
    fs.writeFileSync(path.join(dir, '.cursorrules'), '');
    fs.rmSync(path.join(dir, 'ROADMAP.md'));
    assert.equal(run(['init', '--no-git-hook']).status, 0);
    const codex = JSON.parse(fs.readFileSync(path.join(dir, '.codex/hooks.json'), 'utf8')).hooks;
    assert.match(codex.Stop[0].hooks[0].command, / hook stop --agent codex$/);
    assert.match(codex.PostToolUse[0].matcher, /apply_patch/);
    const cursor = JSON.parse(fs.readFileSync(path.join(dir, '.cursor/hooks.json'), 'utf8'));
    assert.equal(cursor.version, 1);
    assert.match(cursor.hooks.stop[0].command, / hook stop --agent cursor$/);
    assert.match(cursor.hooks.afterFileEdit[0].command, / hook post-tool-use --agent cursor$/);
    /* Installing again changes nothing */
    const before = fs.readFileSync(path.join(dir, '.cursor/hooks.json'), 'utf8');
    run(['hooks', '--install', '--agent', 'cursor']);
    assert.equal(fs.readFileSync(path.join(dir, '.cursor/hooks.json'), 'utf8'), before);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Cursor gets JSON: brief as additional_context, reminders as followup_message', () => {
  const { dir, run } = project();
  const payload = extra => JSON.stringify({ workspace_roots: [dir], ...extra });
  try {
    const other = os.tmpdir();   /* hooks may run from anywhere: workspace_roots wins */
    const brief = JSON.parse(run(['hook', 'session-start', '--agent', 'cursor'], payload({}), other).stdout);
    assert.match(brief.additional_context, /^\[visual-roadmap\] Hooks/);
    fs.writeFileSync(path.join(dir, 'utils.js'), 'x\n');
    const stop = run(['hook', 'stop', '--agent', 'cursor'], payload({ status: 'completed', loop_count: 0 }), other);
    assert.equal(stop.status, 0, 'Cursor continues through followup_message, not exit 2');
    assert.match(JSON.parse(stop.stdout).followup_message, /no active task/);
    assert.equal(run(['hook', 'stop', '--agent', 'cursor'], payload({ loop_count: 1 }), other).stdout, '', 'asks once');
    fs.writeFileSync(path.join(dir, 'pdf-export.js'), 'x\n');
    run(['hook', 'post-tool-use', '--agent', 'cursor'], payload({ file_path: path.join(dir, 'pdf-export.js') }), other);
    assert.match(fs.readFileSync(path.join(dir, 'ROADMAP.md'), 'utf8'), /\| T002 Export to PDF \| active \|/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Codex: stop answers JSON when quiet, exit 2 when it needs the agent; apply_patch counts as code', () => {
  const { dir, run } = project();
  const payload = extra => JSON.stringify({ cwd: dir, ...extra });
  try {
    const quiet = run(['hook', 'stop', '--agent', 'codex'], payload({ stop_hook_active: false }));
    assert.deepEqual([quiet.status, quiet.stdout.trim()], [0, '{}']);
    fs.writeFileSync(path.join(dir, 'utils.js'), 'x\n');
    const stop = run(['hook', 'stop', '--agent', 'codex'], payload({ stop_hook_active: false }));
    assert.equal(stop.status, 2);
    assert.match(stop.stderr, /no active task/);
    fs.writeFileSync(path.join(dir, 'search-filters.js'), 'x\n');
    const post = run(['hook', 'post-tool-use', '--agent', 'codex'], payload({ tool_name: 'apply_patch' }));
    assert.match(JSON.parse(post.stdout).hookSpecificOutput.additionalContext, /T001 started automatically/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
