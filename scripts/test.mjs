import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = readdirSync(join(root, 'test'))
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => join('test', name));

const watch = process.argv.includes('--watch');
const args = ['--test', ...(watch ? ['--watch'] : []), ...files];
const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
