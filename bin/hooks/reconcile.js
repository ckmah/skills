#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCliHandlers, createDefaultDeps } from '../lib/cli-core.js';
import { resolveRepoDir } from '../lib/paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoDir = resolveRepoDir(path.join(__dirname, '..', '..'));

async function main() {
  try {
    const deps = createDefaultDeps({ repoDir });
    const handlers = createCliHandlers(deps);
    const result = await handlers.reconcile();
    if (result.changed) {
      process.stdout.write('Reconciled manifest and pushed changes.\n');
    }
  } catch (err) {
    process.stderr.write(`${err.message ?? err}\n`);
    process.exit(0);
  }
}

main();
