/* lib/setup.js — first-run decisions for `visual-roadmap` / `up`:
   whether to add the package to the project, with which package manager,
   and how hooks should call the CLI back. Pure checks on the file system, no spawning. */

'use strict';

const fs   = require('fs');
const path = require('path');

const NAME = 'visual-roadmap';

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** Dev-dependency install command for the project's package manager, picked by lockfile. */
function installCommand(dir) {
  const has = f => fs.existsSync(path.join(dir, f));
  if (has('pnpm-lock.yaml')) return ['pnpm', 'add', '-D', NAME];
  if (has('bun.lock') || has('bun.lockb')) return ['bun', 'add', '-d', NAME];
  if (has('yarn.lock')) return ['yarn', 'add', '-D', NAME];
  return ['npm', 'install', '--save-dev', NAME];
}

/** A JS project (package.json) that neither declares nor has the package installed. */
function needsInstall(dir) {
  const pkg = readJson(path.join(dir, 'package.json'));
  if (!pkg || pkg.name === NAME) return false;
  if (fs.existsSync(path.join(dir, 'node_modules', NAME))) return false;
  return !['dependencies', 'devDependencies', 'optionalDependencies'].some(k => pkg[k] && pkg[k][NAME]);
}

/** How hooks call the CLI: the project's copy, a pinned npx when running from the
    npx cache (that folder can be cleaned at any time), else this checkout. */
function selfCommand(dir, self, version) {
  if (fs.existsSync(path.join(dir, 'node_modules', NAME, 'bin', `${NAME}.js`))) return `npx --no ${NAME}`;
  if (/[\\/]_npx[\\/]/.test(self)) return `npx -y ${NAME}@${version}`;
  return `node "${path.join(self, 'bin', `${NAME}.js`).replace(/\\/g, '/')}"`;
}

module.exports = { installCommand, needsInstall, selfCommand };
