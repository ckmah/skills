import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldReconcile, buildReconcilePlan } from '../bin/lib/reconcile.js';
import lock from './fixtures/sample-lock.json' with { type: 'json' };
import manifest from './fixtures/sample-manifest.json' with { type: 'json' };

test('shouldReconcile returns false when manifest matches lock', () => {
  assert.equal(
    shouldReconcile(manifest, lock, { wildcardRepos: ['obra/superpowers'], collapseFullRepos: true }),
    false,
  );
});

test('shouldReconcile returns true when lock has new skill', () => {
  const explicitManifest = {
    ...manifest,
    sources: [
      {
        repo: 'obra/superpowers',
        skills: Object.keys(lock.skills).filter((name) => lock.skills[name].source === 'obra/superpowers'),
      },
      { repo: 'vercel-labs/skills', skills: ['find-skills'] },
    ],
  };
  const changedLock = {
    ...lock,
    skills: {
      ...lock.skills,
      'new-skill': {
        source: 'obra/superpowers',
        sourceType: 'github',
        sourceUrl: 'https://github.com/obra/superpowers.git',
        skillPath: 'skills/new-skill/SKILL.md',
      },
    },
  };
  assert.equal(
    shouldReconcile(explicitManifest, changedLock, { wildcardRepos: ['obra/superpowers'], collapseFullRepos: true }),
    true,
  );
});

test('buildReconcilePlan lists files to commit', () => {
  const explicitManifest = {
    ...manifest,
    sources: [
      {
        repo: 'obra/superpowers',
        skills: Object.keys(lock.skills).filter((name) => lock.skills[name].source === 'obra/superpowers'),
      },
      { repo: 'vercel-labs/skills', skills: ['find-skills'] },
    ],
  };
  const changedLock = {
    ...lock,
    skills: {
      ...lock.skills,
      'new-skill': {
        source: 'obra/superpowers',
        sourceType: 'github',
        sourceUrl: 'https://github.com/obra/superpowers.git',
        skillPath: 'skills/new-skill/SKILL.md',
      },
    },
  };
  const plan = buildReconcilePlan(explicitManifest, changedLock, '# readme\n<!-- SKILLS:START -->\n<!-- SKILLS:END -->\n', {
    wildcardRepos: ['obra/superpowers'],
    collapseFullRepos: true,
    now: new Date('2026-05-31'),
  });
  assert.equal(plan.changed, true);
  assert.deepEqual(plan.files, ['manifest.json', 'README.md']);
  assert.match(plan.readme, /new-skill/);
});
