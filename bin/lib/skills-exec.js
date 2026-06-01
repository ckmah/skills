import { execFileSync } from 'node:child_process';

export function shouldUseCopy(platform, installMethod = 'auto') {
  if (installMethod === 'copy') return true;
  if (installMethod === 'symlink') return false;
  return platform === 'win32';
}

export function buildAddCommand({ repo, skills, agents = [], global: isGlobal = true, copy = false }) {
  const cmd = ['npx', 'skills', 'add', repo];
  for (const skill of skills) {
    cmd.push('--skill', skill);
  }
  if (isGlobal) cmd.push('-g');
  for (const agent of agents) {
    cmd.push('-a', agent);
  }
  cmd.push('-y');
  if (copy) cmd.push('--copy');
  return cmd;
}

export function buildRemoveCommand({ skill, global: isGlobal = true }) {
  const cmd = ['npx', 'skills', 'remove', skill];
  if (isGlobal) cmd.push('-g');
  cmd.push('-y');
  return cmd;
}

export function buildUpdateCommand({ global: isGlobal = true }) {
  const cmd = ['npx', 'skills', 'update'];
  if (isGlobal) cmd.push('-g');
  cmd.push('-y');
  return cmd;
}

export function buildCheckCommand({ global: isGlobal = true }) {
  const cmd = ['npx', 'skills', 'check'];
  if (isGlobal) cmd.push('-g');
  return cmd;
}

export function runSkillsCommand(cmd, execFile = execFileSync) {
  const [executable, ...args] = cmd;
  return execFile(executable, args, { stdio: 'inherit' });
}
