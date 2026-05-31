import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCommitMessage,
  commitAndPush,
  pullRepo,
  hasStagedChanges,
  resolveGitIdentity,
} from '../bin/lib/git.js';

const testIdentity = { name: 'Test User', email: 'test@example.com' };

test('formatCommitMessage prefixes skills changes', () => {
  assert.equal(formatCommitMessage('add', 'brainstorming'), 'skills: add brainstorming');
  assert.equal(formatCommitMessage('remove', 'find-skills'), 'skills: remove find-skills');
  assert.equal(formatCommitMessage('sync'), 'skills: sync manifest');
});

test('commitAndPush stages files, commits, and pushes', () => {
  const calls = [];
  const execFile = (cmd, args, opts) => {
    calls.push({ cmd, args, cwd: opts?.cwd });
    if (cmd === 'git' && args[0] === 'diff') {
      const err = new Error('has staged changes');
      err.status = 1;
      throw err;
    }
    return Buffer.from('');
  };
  const result = commitAndPush({
    repoDir: '/repo',
    files: ['manifest.json', 'README.md'],
    message: 'skills: add foo',
    execFile,
    identity: testIdentity,
  });
  assert.equal(result.committed, true);
  assert.deepEqual(calls[0].args, ['add', 'manifest.json', 'README.md']);
  assert.ok(calls.some((c) => c.args[0] === 'commit' && c.args.includes('skills: add foo')));
  assert.ok(calls.some((c) => c.args[0] === 'push'));
});

test('commitAndPush skips commit when no staged changes', () => {
  const execFile = () => Buffer.from('');
  const result = commitAndPush({
    repoDir: '/repo',
    files: ['manifest.json'],
    message: 'skills: sync manifest',
    execFile,
    identity: testIdentity,
  });
  assert.equal(result.committed, false);
});

test('hasStagedChanges detects staged diff', () => {
  const execFile = (cmd, args) => {
    if (cmd === 'git' && args[0] === 'diff') {
      const err = new Error('staged');
      err.status = 1;
      throw err;
    }
    return Buffer.from('');
  };
  assert.equal(hasStagedChanges({ repoDir: '/repo', execFile }), true);
});

test('resolveGitIdentity falls back to global git config', () => {
  const exec = () => {
    throw new Error('gh unavailable');
  };
  const execFile = (cmd, args) => {
    if (args.includes('user.name')) return Buffer.from('Git User');
    if (args.includes('user.email')) return Buffer.from('git@example.com');
    return Buffer.from('');
  };
  assert.deepEqual(resolveGitIdentity({ exec, execFile }), {
    name: 'Git User',
    email: 'git@example.com',
  });
});

test('pullRepo runs fetch and pull', () => {
  const calls = [];
  const execFile = (cmd, args) => {
    calls.push(args);
    return Buffer.from('');
  };
  pullRepo({ repoDir: '/repo', branch: 'main', execFile });
  assert.deepEqual(calls, [['fetch', 'origin'], ['pull', 'origin', 'main']]);
});
