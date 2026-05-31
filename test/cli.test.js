import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, createCliHandlers } from '../bin/lib/cli-core.js';

test('parseArgs extracts subcommand and flags', () => {
  assert.deepEqual(parseArgs(['sync', '--quiet']), { command: 'sync', flags: { quiet: true }, args: [] });
  assert.deepEqual(parseArgs(['add', 'obra/superpowers', '--skill', 'foo']), {
    command: 'add',
    flags: { skill: 'foo' },
    args: ['obra/superpowers'],
  });
});

test('add command updates manifest and commits', async () => {
  const calls = [];
  const handlers = createCliHandlers({
    readManifest: () => ({
      version: 1,
      agents: ['cursor', 'claude-code'],
      installMethod: 'auto',
      customRepo: 'ckmah/skills',
      sources: [{ repo: 'obra/superpowers', skills: ['*'] }],
    }),
    readLock: () => ({
      skills: {
        brainstorming: { source: 'obra/superpowers' },
        'new-skill': { source: 'obra/superpowers' },
      },
    }),
    readReadme: () => '# test\n<!-- SKILLS:START -->\n<!-- SKILLS:END -->\n',
    writeManifest: (m) => calls.push(['writeManifest', m]),
    writeReadme: (r) => calls.push(['writeReadme', r]),
    runSkills: (cmd) => calls.push(['runSkills', cmd]),
    commit: (opts) => {
      calls.push(['commit', opts]);
      return { committed: true };
    },
    platform: 'linux',
  });

  await handlers.add(['obra/superpowers'], { skill: 'new-skill' });
  assert.ok(calls.some((c) => c[0] === 'runSkills'));
  assert.ok(calls.some((c) => c[0] === 'writeManifest'));
  assert.ok(calls.some((c) => c[0] === 'commit'));
});

test('sync quiet exits without output when unchanged', async () => {
  let output = '';
  const handlers = createCliHandlers({
    pull: () => {},
    readManifest: () => ({ version: 1, sources: [] }),
    readReadme: () => '# test\n<!-- SKILLS:START -->\n<!-- SKILLS:END -->\n',
    manifestHash: () => 'abc',
    lastManifestHash: () => 'abc',
    installFromManifest: () => {},
    readLock: () => ({ skills: {} }),
    shouldReconcile: () => false,
    log: (msg) => {
      output += msg;
    },
  });
  await handlers.sync([], { quiet: true });
  assert.equal(output, '');
});
