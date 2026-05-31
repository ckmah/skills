import { execSync as defaultExec } from 'node:child_process';

export function formatCommitMessage(action, detail) {
  if (action === 'sync') return 'skills: sync manifest';
  return `skills: ${action} ${detail}`;
}

export function commitAndPush({ repoDir, files, message, exec = defaultExec }) {
  exec(`git add ${files.map((f) => quote(f)).join(' ')}`, { cwd: repoDir, stdio: 'pipe' });
  if (!hasStagedChanges({ repoDir, exec })) {
    return { committed: false };
  }
  exec(`git commit -m ${quote(message)}`, { cwd: repoDir, stdio: 'pipe' });
  exec('git push origin HEAD', { cwd: repoDir, stdio: 'pipe' });
  return { committed: true };
}

export function pullRepo({ repoDir, branch = 'main', exec = defaultExec }) {
  exec('git fetch origin', { cwd: repoDir, stdio: 'pipe' });
  exec(`git pull origin ${branch}`, { cwd: repoDir, stdio: 'pipe' });
}

export function hasStagedChanges({ repoDir, exec = defaultExec }) {
  try {
    exec('git diff --cached --quiet', { cwd: repoDir, stdio: 'pipe' });
    return false;
  } catch {
    return true;
  }
}

export function hasWorkingChanges({ repoDir, exec = defaultExec }) {
  const status = exec('git status --porcelain', { cwd: repoDir, encoding: 'utf8', stdio: 'pipe' });
  return status.trim().length > 0;
}

function quote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}
