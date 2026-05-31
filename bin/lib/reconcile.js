import { mergeManifestFromLock, manifestNeedsUpdate } from './manifest.js';
import { updateReadmeSkillsSection } from './readme.js';
import { formatCommitMessage } from './git.js';

export function shouldReconcile(manifest, lock, options = {}) {
  return manifestNeedsUpdate(manifest, lock, options);
}

export function buildReconcilePlan(manifest, lock, readme, options = {}) {
  const mergeOptions = {
    collapseFullRepos: true,
    wildcardRepos: options.wildcardRepos ?? ['obra/superpowers'],
    ...options,
  };

  if (!shouldReconcile(manifest, lock, mergeOptions)) {
    return { changed: false };
  }

  const updatedManifest = mergeManifestFromLock(manifest, lock, mergeOptions);
  const updatedReadme = updateReadmeSkillsSection(readme, updatedManifest, lock, options);

  return {
    changed: true,
    manifest: updatedManifest,
    readme: updatedReadme,
    files: ['manifest.json', 'README.md'],
    message: formatCommitMessage('sync'),
  };
}
