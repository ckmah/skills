import { execFileSync as defaultExecFile } from 'node:child_process';

export function formatCommitMessage(action, detail) {
  if (action === 'sync') return 'skills: sync manifest';
  return `skills: ${action} ${detail}`;
}

function runGit(args, { repoDir, execFile = defaultExecFile }) {
  return execFile('git', args, { cwd: repoDir, stdio: 'pipe' });
}

export function commitAndPush({ repoDir, files, message, execFile = defaultExecFile }) {
  runGit(['add', ...files], { repoDir, execFile });
  if (!hasStagedChanges({ repoDir, execFile })) {
    return { committed: false };
  }
  runGit(['commit', '-m', message], { repoDir, execFile });
  runGit(['push', 'origin', 'HEAD'], { repoDir, execFile });
  return { committed: true };
}

export function pullRepo({ repoDir, branch = 'main', execFile = defaultExecFile }) {
  runGit(['fetch', 'origin'], { repoDir, execFile });
  runGit(['pull', 'origin', branch], { repoDir, execFile });
}

export function hasStagedChanges({ repoDir, execFile = defaultExecFile }) {
  try {
    runGit(['diff', '--cached', '--quiet'], { repoDir, execFile });
    return false;
  } catch {
    return true;
  }
}

export function hasWorkingChanges({ repoDir, execFile = defaultExecFile }) {
  const status = runGit(['status', '--porcelain'], { repoDir, execFile }).toString();
  return status.trim().length > 0;
}
