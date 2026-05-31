import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const GITHUB_REPO = 'git@github.com:ckmah/skills.git';
export const GITHUB_REPO_HTTPS = 'https://github.com/ckmah/skills.git';

export function getCloneDir(homeDir = os.homedir()) {
  return path.join(homeDir, '.config', 'ckmah', 'skills');
}

export function getLockFilePath(homeDir = os.homedir()) {
  return path.join(homeDir, '.agents', '.skill-lock.json');
}

export function getCursorHooksPath(homeDir = os.homedir()) {
  return path.join(homeDir, '.cursor', 'hooks.json');
}

export function getPackageRoot(startDir = path.join(__dirname, '..', '..')) {
  return startDir;
}

export function isSkillsRepoDir(dir, exists = fs.existsSync) {
  return exists(path.join(dir, '.git')) && exists(path.join(dir, 'manifest.json')) && exists(path.join(dir, 'bin', 'cli.js'));
}

export function resolveRepoDir(options = {}) {
  const homeDir = options.homeDir ?? os.homedir();
  const cwd = options.cwd ?? process.cwd();
  const exists = options.exists ?? fs.existsSync;

  const cloneDir = getCloneDir(homeDir);
  if (isSkillsRepoDir(cloneDir, exists)) {
    return cloneDir;
  }

  const packageRoot = getPackageRoot();
  if (isSkillsRepoDir(packageRoot, exists)) {
    return packageRoot;
  }

  if (isSkillsRepoDir(cwd, exists)) {
    return cwd;
  }

  throw new Error(
    'ckmah-skills git repo not found. Run once: npx github:ckmah/skills setup',
  );
}

export function cliScriptPath(repoDir) {
  return path.join(repoDir, 'bin', 'cli.js').replace(/\\/g, '/');
}

export function reconcileScriptPath(repoDir) {
  return path.join(repoDir, 'bin', 'hooks', 'reconcile.js').replace(/\\/g, '/');
}
