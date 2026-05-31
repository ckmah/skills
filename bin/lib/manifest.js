export function lockToManifestSources(lock, options = {}) {
  const grouped = new Map();

  for (const [name, entry] of Object.entries(lock.skills ?? {})) {
    const repo = entry.source;
    if (!grouped.has(repo)) grouped.set(repo, []);
    grouped.get(repo).push(name);
  }

  const sources = [...grouped.entries()].map(([repo, skills]) => {
    const sorted = [...skills].sort();
    if (options.collapseFullRepos && shouldCollapseRepo(repo, sorted, options)) {
      return { repo, skills: ['*'] };
    }
    return { repo, skills: sorted };
  });

  return sources.sort((a, b) => a.repo.localeCompare(b.repo));
}

function shouldCollapseRepo(repo, skills, options) {
  if (options.wildcardRepos?.includes(repo)) return true;
  const counts = options.fullRepoSkillCounts ?? {};
  return counts[repo] != null && skills.length >= counts[repo];
}

export function isCustomSource(source, customRepo) {
  return source.repo === customRepo || source.path === 'skills';
}

export function mergeManifestFromLock(manifest, lock, options = {}) {
  const customRepo = manifest.customRepo ?? 'ckmah/skills';
  const customSources = (manifest.sources ?? []).filter((s) => isCustomSource(s, customRepo));
  const lockSources = lockToManifestSources(lock, options);
  const lockRepos = new Set(lockSources.map((s) => s.repo));

  const mergedCustom = customSources.filter((s) => !lockRepos.has(s.repo));
  return {
    ...manifest,
    sources: [...lockSources, ...mergedCustom].sort((a, b) => a.repo.localeCompare(b.repo)),
  };
}

export function expandManifestSkills(manifest, lock) {
  const lockSkills = lock?.skills ?? {};
  const entries = [];

  for (const source of manifest.sources ?? []) {
    const repo = source.repo;
    const custom = isCustomSource(source, manifest.customRepo ?? 'ckmah/skills');

    for (const skill of source.skills ?? []) {
      if (skill === '*') {
        for (const [name, entry] of Object.entries(lockSkills)) {
          if (entry.source === repo) {
            entries.push({ name, repo, custom });
          }
        }
      } else if (lockSkills[skill]?.source === repo || custom) {
        entries.push({ name: skill, repo, custom });
      } else if (custom) {
        entries.push({ name: skill, repo, custom: true });
      }
    }
  }

  const seen = new Set();
  return entries
    .filter((e) => {
      const key = e.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function manifestNeedsUpdate(manifest, lock, options = {}) {
  const merged = mergeManifestFromLock(manifest, lock, options);
  return JSON.stringify(merged.sources) !== JSON.stringify(manifest.sources);
}
