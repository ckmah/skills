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

export function resolveRepoDir(cwd = process.cwd(), homeDir = os.homedir()) {
  const cloneDir = getCloneDir(homeDir);
  if (cwd.startsWith(cloneDir)) return cloneDir;
  const localRoot = getPackageRoot(path.join(__dirname, '..', '..'));
  return localRoot;
}

export function cliScriptPath(repoDir) {
  return path.join(repoDir, 'bin', 'cli.js').replace(/\\/g, '/');
}

export function reconcileScriptPath(repoDir) {
  return path.join(repoDir, 'bin', 'hooks', 'reconcile.js').replace(/\\/g, '/');
}
