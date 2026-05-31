export function buildCursorHooks(repoDir, cliPath, reconcilePath) {
  const syncCommand = `node ${cliPath} sync --quiet`;
  const reconcileCommand = `node ${reconcilePath}`;

  return {
    hooks: {
      sessionStart: [{ command: syncCommand, timeout: 120 }],
      afterShellExecution: [{ command: reconcileCommand, matcher: 'npx skills' }],
    },
  };
}

export function mergeCursorHooks(existing, incoming) {
  const base = existing && typeof existing === 'object' ? existing : {};
  const hooks = { ...(base.hooks ?? {}) };

  for (const [name, entries] of Object.entries(incoming.hooks ?? {})) {
    const current = Array.isArray(hooks[name]) ? hooks[name] : [];
    const merged = [...current];
    for (const entry of entries) {
      const duplicate = merged.some((e) => e.command === entry.command);
      if (!duplicate) merged.push(entry);
    }
    hooks[name] = merged;
  }

  return { ...base, hooks };
}
