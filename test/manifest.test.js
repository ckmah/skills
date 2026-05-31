import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lockToManifestSources,
  mergeManifestFromLock,
  expandManifestSkills,
  isCustomSource,
} from '../bin/lib/manifest.js';
import lock from './fixtures/sample-lock.json' with { type: 'json' };
import manifest from './fixtures/sample-manifest.json' with { type: 'json' };

test('groups lock entries by source repo', () => {
  const sources = lockToManifestSources(lock);
  assert.equal(sources.find((s) => s.repo === 'obra/superpowers').skills.length, 14);
  assert.deepEqual(sources.find((s) => s.repo === 'vercel-labs/skills').skills, ['find-skills']);
});

test('collapses full repo to wildcard when all skills present', () => {
  const sources = lockToManifestSources(lock, {
    collapseFullRepos: true,
    wildcardRepos: ['obra/superpowers'],
  });
  assert.deepEqual(sources.find((s) => s.repo === 'obra/superpowers').skills, ['*']);
});

test('mergeManifestFromLock preserves custom sources', () => {
  const current = {
    ...manifest,
    sources: [
      ...manifest.sources,
      { repo: 'ckmah/skills', path: 'skills', skills: ['my-workflow'] },
    ],
  };
  const merged = mergeManifestFromLock(current, lock, {
    collapseFullRepos: true,
    wildcardRepos: ['obra/superpowers'],
  });
  assert.ok(merged.sources.some((s) => s.repo === 'ckmah/skills' && s.skills.includes('my-workflow')));
});

test('expandManifestSkills resolves wildcard via lock file', () => {
  const skills = expandManifestSkills(manifest, lock);
  assert.equal(skills.length, 15);
  assert.ok(skills.some((s) => s.name === 'brainstorming' && s.repo === 'obra/superpowers'));
});

test('isCustomSource identifies custom repo entries', () => {
  assert.equal(isCustomSource({ repo: 'ckmah/skills', path: 'skills', skills: ['x'] }, 'ckmah/skills'), true);
  assert.equal(isCustomSource({ repo: 'obra/superpowers', skills: ['*'] }, 'ckmah/skills'), false);
});
