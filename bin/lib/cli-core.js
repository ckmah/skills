import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { mergeManifestFromLock } from './manifest.js';
import { updateReadmeSkillsSection } from './readme.js';
import { buildAddCommand, buildRemoveCommand, buildUpdateCommand, buildCheckCommand, shouldUseCopy, runSkillsCommand } from './skills-exec.js';
import { commitAndPush, pullRepo, formatCommitMessage } from './git.js';
import { buildReconcilePlan } from './reconcile.js';
import { buildCursorHooks, mergeCursorHooks } from './hooks.js';
import { getSchedulerPlatform, schedulerInstallScript } from './scheduler.js';
import {
  getCloneDir,
  getLockFilePath,
  getCursorHooksPath,
  resolveRepoDir,
  cliScriptPath,
  reconcileScriptPath,
  GITHUB_REPO,
  GITHUB_REPO_HTTPS,
} from './paths.js';

const DEFAULT_WILDCARD_REPOS = ['obra/superpowers'];

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  const args = [];

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      args.push(token);
    }
  }

  return { command, flags, args };
}

export function createDefaultDeps(overrides = {}) {
  const repoDir = overrides.repoDir ?? resolveRepoDir();
  const homeDir = overrides.homeDir ?? undefined;

  return {
    repoDir,
    homeDir,
    platform: overrides.platform ?? process.platform,
    exec: overrides.exec ?? execSync,
    readFile: overrides.readFile ?? ((file) => fs.readFileSync(file, 'utf8')),
    writeFile: overrides.writeFile ?? ((file, content) => fs.writeFileSync(file, content, 'utf8')),
    exists: overrides.exists ?? ((file) => fs.existsSync(file)),
    mkdir: overrides.mkdir ?? ((dir) => fs.mkdirSync(dir, { recursive: true })),
    log: overrides.log ?? console.log,
    error: overrides.error ?? console.error,
    readManifest: overrides.readManifest ?? (() => JSON.parse(fs.readFileSync(path.join(repoDir, 'manifest.json'), 'utf8'))),
    writeManifest: overrides.writeManifest ?? ((manifest) => fs.writeFileSync(path.join(repoDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')),
    readLock: overrides.readLock ?? (() => JSON.parse(fs.readFileSync(getLockFilePath(homeDir), 'utf8'))),
    readReadme: overrides.readReadme ?? (() => fs.readFileSync(path.join(repoDir, 'README.md'), 'utf8')),
    writeReadme: overrides.writeReadme ?? ((content) => fs.writeFileSync(path.join(repoDir, 'README.md'), content, 'utf8')),
    runSkills: overrides.runSkills ?? ((cmd) => runSkillsCommand(cmd, execSync)),
    commit: overrides.commit ?? ((opts) => commitAndPush({ repoDir, ...opts, exec: execSync })),
    pull: overrides.pull ?? (() => pullRepo({ repoDir, exec: execSync })),
    manifestHash: overrides.manifestHash,
    lastManifestHash: overrides.lastManifestHash,
    installFromManifest: overrides.installFromManifest,
    shouldReconcile: overrides.shouldReconcile,
    ...overrides,
  };
}

export function createCliHandlers(deps) {
  const mergeOptions = () => ({
    collapseFullRepos: true,
    wildcardRepos: DEFAULT_WILDCARD_REPOS,
  });

  async function installFromManifest(manifest, quiet = false) {
    const copy = shouldUseCopy(deps.platform, manifest.installMethod);
    for (const source of manifest.sources ?? []) {
      const cmd = buildAddCommand({
        repo: source.repo,
        skills: source.skills,
        agents: manifest.agents ?? ['cursor', 'claude-code'],
        global: manifest.scope !== 'project',
        copy,
      });
      if (!quiet) deps.log(`Installing ${source.repo}...`);
      deps.runSkills(cmd);
    }
  }

  async function persistManifestAndReadme(manifest, lock, action, detail) {
    deps.writeManifest(manifest);
    const readme = updateReadmeSkillsSection(deps.readReadme(), manifest, lock);
    deps.writeReadme(readme);
    return deps.commit({
      files: ['manifest.json', 'README.md'],
      message: formatCommitMessage(action, detail),
    });
  }

  return {
    async setup() {
      const cloneDir = getCloneDir(deps.homeDir);
      deps.mkdir(path.dirname(cloneDir));
      if (!deps.exists(cloneDir)) {
        deps.exec(`git clone ${GITHUB_REPO} "${cloneDir}"`, { stdio: 'inherit' });
      }
      try {
        deps.exec('git fetch origin', { cwd: cloneDir, stdio: 'pipe' });
      } catch {
        deps.exec(`git clone ${GITHUB_REPO_HTTPS} "${cloneDir}"`, { stdio: 'inherit' });
        deps.exec('git fetch origin', { cwd: cloneDir, stdio: 'pipe' });
      }

      const manifest = JSON.parse(deps.readFile(path.join(cloneDir, 'manifest.json')));
      await installFromManifest(manifest);

      const platform = getSchedulerPlatform(deps.platform);
      const script = schedulerInstallScript(platform, cloneDir);
      if (platform === 'windows') {
        deps.exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${path.join(cloneDir, 'bin', 'scheduler', 'install-windows.ps1')}"`, { stdio: 'inherit' });
      } else if (platform === 'macos') {
        deps.exec(`bash "${path.join(cloneDir, 'bin', 'scheduler', 'install-macos.sh')}"`, { stdio: 'inherit' });
      } else {
        deps.exec(`bash "${path.join(cloneDir, 'bin', 'scheduler', 'install-linux.sh')}"`, { stdio: 'inherit' });
      }

      const hooksPath = getCursorHooksPath(deps.homeDir);
      deps.mkdir(path.dirname(hooksPath));
      const existing = deps.exists(hooksPath) ? JSON.parse(deps.readFile(hooksPath)) : {};
      const merged = mergeCursorHooks(
        existing,
        buildCursorHooks(cloneDir, cliScriptPath(cloneDir), reconcileScriptPath(cloneDir)),
      );
      deps.writeFile(hooksPath, `${JSON.stringify(merged, null, 2)}\n`);
      deps.log(`Setup complete. Clone: ${cloneDir}`);
    },

    async install(_args, flags) {
      const manifest = deps.readManifest();
      await installFromManifest(manifest, flags.quiet);
    },

    async add(args, flags) {
      const [repo] = args;
      if (!repo) throw new Error('Usage: add <repo> [--skill name]');
      const manifest = deps.readManifest();
      const skills = flags.skill ? [flags.skill] : ['*'];
      const copy = shouldUseCopy(deps.platform, manifest.installMethod);
      deps.runSkills(
        buildAddCommand({
          repo,
          skills,
          agents: manifest.agents,
          global: true,
          copy,
        }),
      );
      const lock = deps.readLock();
      const updated = mergeManifestFromLock(manifest, lock, mergeOptions());
      await persistManifestAndReadme(updated, lock, 'add', flags.skill ?? repo);
    },

    async remove(args) {
      const [skill] = args;
      if (!skill) throw new Error('Usage: remove <skill>');
      deps.runSkills(buildRemoveCommand({ skill, global: true }));
      const manifest = deps.readManifest();
      const lock = deps.readLock();
      const updated = mergeManifestFromLock(manifest, lock, mergeOptions());
      await persistManifestAndReadme(updated, lock, 'remove', skill);
    },

    async sync(_args, flags) {
      deps.pull();
      const manifest = deps.readManifest();
      const hash = JSON.stringify(manifest.sources);
      const prev = deps.lastManifestHash?.() ?? hash;
      if (hash !== prev || !flags.quiet) {
        await installFromManifest(manifest, flags.quiet);
      }

      const lock = deps.readLock();
      const reconcile = buildReconcilePlan(manifest, lock, deps.readReadme(), mergeOptions());
      if (reconcile.changed) {
        deps.writeManifest(reconcile.manifest);
        deps.writeReadme(reconcile.readme);
        deps.commit({ files: reconcile.files, message: reconcile.message });
      } else if (!flags.quiet) {
        deps.log('Already up to date.');
      }
    },

    async update(_args, flags) {
      deps.runSkills(buildUpdateCommand({ global: true }));
      const manifest = deps.readManifest();
      const lock = deps.readLock();
      const updated = mergeManifestFromLock(manifest, lock, mergeOptions());
      const readme = updateReadmeSkillsSection(deps.readReadme(), updated, lock);
      deps.writeManifest(updated);
      deps.writeReadme(readme);
      deps.commit({ files: ['manifest.json', 'README.md'], message: 'skills: update registry skills' });
      if (!flags.quiet) deps.log('Updated registry skills.');
    },

    async check() {
      deps.runSkills(buildCheckCommand({ global: true }));
    },

    async watch(args, flags) {
      const minutes = Number(flags.interval ?? args[0] ?? 15);
      deps.log(`Watching for changes every ${minutes} minutes...`);
      for (;;) {
        await this.sync([], { quiet: true });
        await new Promise((resolve) => setTimeout(resolve, minutes * 60 * 1000));
      }
    },

    async reconcile() {
      const manifest = deps.readManifest();
      const lock = deps.readLock();
      const plan = buildReconcilePlan(manifest, lock, deps.readReadme(), mergeOptions());
      if (!plan.changed) return { changed: false };
      deps.writeManifest(plan.manifest);
      deps.writeReadme(plan.readme);
      deps.commit({ files: plan.files, message: plan.message });
      return { changed: true };
    },
  };
}

export async function runCli(argv, overrides = {}) {
  const { command, flags, args } = parseArgs(argv);
  if (!command || command === '--help' || command === '-h') {
    return { exitCode: 0, help: true };
  }

  const deps = createDefaultDeps(overrides);
  const handlers = createCliHandlers(deps);
  if (!handlers[command]) {
    throw new Error(`Unknown command: ${command}`);
  }
  await handlers[command](args, flags);
  return { exitCode: 0 };
}

export function printHelp() {
  console.log(`ckmah-skills — hands-free agent skills sync

Usage:
  ckmah-skills setup
  ckmah-skills install
  ckmah-skills add <repo> [--skill name]
  ckmah-skills remove <skill>
  ckmah-skills sync [--quiet]
  ckmah-skills update
  ckmah-skills check
  ckmah-skills watch [--interval 15]
`);
}
