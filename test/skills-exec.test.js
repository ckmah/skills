import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAddCommand,
  buildRemoveCommand,
  buildUpdateCommand,
  buildCheckCommand,
  shouldUseCopy,
} from '../bin/lib/skills-exec.js';

test('buildAddCommand includes agent flags and global options', () => {
  const cmd = buildAddCommand({
    repo: 'obra/superpowers',
    skills: ['brainstorming'],
    agents: ['cursor', 'claude-code'],
    global: true,
    copy: false,
  });
  assert.equal(cmd[0], 'npx');
  assert.ok(cmd.includes('skills'));
  assert.ok(cmd.includes('add'));
  assert.ok(cmd.includes('obra/superpowers'));
  assert.ok(cmd.includes('-g'));
  assert.ok(cmd.includes('-y'));
  assert.ok(cmd.includes('-a'));
  assert.ok(cmd.includes('cursor'));
  assert.ok(cmd.includes('claude-code'));
});

test('buildAddCommand adds --copy when requested', () => {
  const cmd = buildAddCommand({
    repo: 'obra/superpowers',
    skills: ['*'],
    agents: ['cursor'],
    global: true,
    copy: true,
  });
  assert.ok(cmd.includes('--copy'));
});

test('shouldUseCopy returns true on win32 with auto install method', () => {
  assert.equal(shouldUseCopy('win32', 'auto'), true);
  assert.equal(shouldUseCopy('linux', 'auto'), false);
  assert.equal(shouldUseCopy('win32', 'copy'), true);
  assert.equal(shouldUseCopy('win32', 'symlink'), false);
});

test('buildRemoveCommand targets skill globally', () => {
  const cmd = buildRemoveCommand({ skill: 'find-skills', global: true });
  assert.deepEqual(cmd.slice(0, 3), ['npx', 'skills', 'remove']);
  assert.ok(cmd.includes('find-skills'));
  assert.ok(cmd.includes('-g'));
  assert.ok(cmd.includes('-y'));
});

test('buildUpdateCommand and buildCheckCommand use global flag', () => {
  assert.ok(buildUpdateCommand({ global: true }).includes('-g'));
  assert.ok(buildCheckCommand({ global: true }).includes('-g'));
});
