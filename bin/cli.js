#!/usr/bin/env node
import { printHelp, runCli } from './lib/cli-core.js';

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  try {
    await runCli(argv);
  } catch (err) {
    console.error(err.message ?? err);
    process.exit(1);
  }
}

main();
