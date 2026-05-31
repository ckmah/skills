import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSkillsBlock, updateReadmeSkillsSection } from '../bin/lib/readme.js';
import manifest from './fixtures/sample-manifest.json' with { type: 'json' };
import lock from './fixtures/sample-lock.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleReadme = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-readme.md'), 'utf8');

test('generateSkillsBlock produces sorted table with count and timestamp', () => {
  const block = generateSkillsBlock(manifest, lock, {
    now: new Date('2026-05-31T12:00:00Z'),
  });
  assert.match(block, /\| brainstorming \| \[obra\/superpowers\]/);
  assert.match(block, /\*\*15 skills\*\* across 2 sources/);
  assert.match(block, /Last updated: 2026-05-31/);
  const names = [...block.matchAll(/\| ([^|]+) \|/g)].map((m) => m[1].trim());
  assert.deepEqual(names.slice(0, 3), names.slice().sort().slice(0, 3));
});

test('generateSkillsBlock marks custom skills', () => {
  const customManifest = {
    ...manifest,
    sources: [...manifest.sources, { repo: 'ckmah/skills', path: 'skills', skills: ['my-workflow'] }],
  };
  const customLock = {
    ...lock,
    skills: {
      ...lock.skills,
      'my-workflow': {
        source: 'ckmah/skills',
        sourceType: 'github',
        sourceUrl: 'https://github.com/ckmah/skills.git',
        skillPath: 'skills/my-workflow/SKILL.md',
      },
    },
  };
  const block = generateSkillsBlock(customManifest, customLock, { now: new Date('2026-05-31') });
  assert.match(block, /my-workflow \(custom\)/);
});

test('updateReadmeSkillsSection replaces markers', () => {
  const updated = updateReadmeSkillsSection(sampleReadme, manifest, lock, {
    now: new Date('2026-05-31T12:00:00Z'),
  });
  assert.match(updated, /<!-- SKILLS:START -->[\s\S]*brainstorming[\s\S]*<!-- SKILLS:END -->/);
  assert.doesNotMatch(updated, /<!-- placeholder -->/);
});
