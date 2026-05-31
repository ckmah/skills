import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCommitMessage,
  commitAndPush,
  pullRepo,
  hasStagedChanges,
} from '../bin/lib/git.js';

test('formatCommitMessage prefixes skills changes', () => {
  assert.equal(formatCommitMessage('add', 'brainstorming'), 'skills: add brainstorming');
  assert.equal(formatCommitMessage('remove', 'find-skills'), 'skills: remove find-skills');
  assert.equal(formatCommitMessage('sync'), 'skills: sync manifest');
});

test('commitAndPush stages files, commits, and pushes', () => {
  const calls = [];
  const exec = (cmd, opts) => {
    calls.push({ cmd, cwd: opts?.cwd });
    if (cmd.startsWith('git diff --cached --quiet')) {
      const err = new Error('has staged changes');
      err.status = 1;
      throw err;
    }
    return '';
  };
  const result = commitAndPush({
    repoDir: '/repo',
    files: ['manifest.json', 'README.md'],
    message: 'skills: add foo',
    exec,
  });
  assert.equal(result.committed, true);
  assert.ok(calls.some((c) => c.cmd.includes("git add 'manifest.json' 'README.md'")));
  assert.ok(calls.some((c) => c.cmd.includes('git commit -m')));
  assert.ok(calls.some((c) => c.cmd.includes('git push')));
});

test('commitAndPush skips commit when no staged changes', () => {
  const exec = (cmd) => {
    if (cmd.startsWith('git diff --cached --quiet')) return '';
    return '';
  };
  const result = commitAndPush({
    repoDir: '/repo',
    files: ['manifest.json'],
    message: 'skills: sync manifest',
    exec,
  });
  assert.equal(result.committed, false);
});

test('hasStagedChanges detects staged diff', () => {
  const exec = (cmd) => {
    if (cmd === 'git diff --cached --quiet') {
      const err = new Error('staged');
      err.status = 1;
      throw err;
    }
    return '';
  };
  assert.equal(hasStagedChanges({ repoDir: '/repo', exec }), true);
});

test('pullRepo runs fetch and pull', () => {
  const calls = [];
  const exec = (cmd) => {
    calls.push(cmd);
    return '';
  };
  pullRepo({ repoDir: '/repo', branch: 'main', exec });
  assert.deepEqual(calls, ['git fetch origin', 'git pull origin main']);
});
