import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { getCloneDir, isSkillsRepoDir, resolveRepoDir } from '../bin/lib/paths.js';

test('isSkillsRepoDir requires git, manifest, and cli entry', () => {
  const exists = (file) => {
    const name = path.basename(file);
    return name === '.git' || name === 'manifest.json' || file.endsWith(`${path.sep}bin${path.sep}cli.js`);
  };
  assert.equal(isSkillsRepoDir('/repo', exists), true);
  assert.equal(isSkillsRepoDir('/repo', () => false), false);
});

test('resolveRepoDir prefers persistent clone over npx package root', () => {
  const home = '/home/user';
  const cloneDir = getCloneDir(home);
  const npxRoot = '/tmp/npx-abc';
  const exists = (file) => {
    if (file.startsWith(cloneDir)) return true;
    if (file.startsWith(npxRoot)) return file.endsWith('manifest.json') || file.endsWith(`${path.sep}bin${path.sep}cli.js`);
    return false;
  };
  const repoDir = resolveRepoDir({ homeDir: home, cwd: '/anywhere', exists });
  assert.equal(repoDir, cloneDir);
});

test('resolveRepoDir falls back to cwd dev repo when clone missing', () => {
  const devRepo = path.join('C:', 'projects', 'skills');
  const root = devRepo.replace(/\\/g, '/');
  const exists = (file) => file.replace(/\\/g, '/').startsWith(root);
  const repoDir = resolveRepoDir({ homeDir: path.join('C:', 'Users', 'me'), cwd: devRepo, exists });
  assert.equal(repoDir, devRepo);
});

test('resolveRepoDir throws when no repo is available', () => {
  assert.throws(
    () => resolveRepoDir({ homeDir: '/home/user', cwd: '/tmp', exists: () => false }),
    /setup/,
  );
});
