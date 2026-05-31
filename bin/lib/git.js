import { execFileSync as defaultExecFile, execSync as defaultExec } from 'node:child_process';

export function formatCommitMessage(action, detail) {
  if (action === 'sync') return 'skills: sync manifest';
  return `skills: ${action} ${detail}`;
}

function runGit(args, { repoDir, execFile = defaultExecFile, env = process.env }) {
  return execFile('git', args, { cwd: repoDir, stdio: 'pipe', env: { ...process.env, ...env } });
}

export function resolveGitIdentity({ execFile = defaultExecFile, exec = defaultExec } = {}) {
  try {
    const json = exec('gh api user', { encoding: 'utf8', stdio: 'pipe' });
    const user = JSON.parse(json);
    const name = user.name || user.login;
    return { name, email: `${user.login}@users.noreply.github.com` };
  } catch {
    const name = execFile('git', ['config', '--global', 'user.name'], { encoding: 'utf8' }).trim();
    const email = execFile('git', ['config', '--global', 'user.email'], { encoding: 'utf8' }).trim();
    if (name && email) return { name, email };
    throw new Error('Git identity not configured. Set git user.name/user.email or log in with gh auth login.');
  }
}

export function ensureRepoGitIdentity({ repoDir, identity, execFile = defaultExecFile }) {
  const resolved = identity ?? resolveGitIdentity({ execFile });
  runGit(['config', 'user.name', resolved.name], { repoDir, execFile });
  runGit(['config', 'user.email', resolved.email], { repoDir, execFile });
  return resolved;
}

export function commitAndPush({ repoDir, files, message, execFile = defaultExecFile, identity }) {
  const resolved = identity ?? resolveGitIdentity({ execFile });
  const env = {
    GIT_AUTHOR_NAME: resolved.name,
    GIT_AUTHOR_EMAIL: resolved.email,
    GIT_COMMITTER_NAME: resolved.name,
    GIT_COMMITTER_EMAIL: resolved.email,
  };
  runGit(['add', ...files], { repoDir, execFile, env });
  if (!hasStagedChanges({ repoDir, execFile })) {
    return { committed: false };
  }
  runGit(['commit', '-m', message], { repoDir, execFile, env });
  runGit(['push', 'origin', 'HEAD'], { repoDir, execFile, env });
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
