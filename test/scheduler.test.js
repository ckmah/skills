import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSchedulerPlatform,
  buildWindowsTaskCommand,
  buildLaunchdPlist,
  buildSystemdTimerUnit,
  buildSystemdServiceUnit,
} from '../bin/lib/scheduler.js';

test('getSchedulerPlatform maps os to scheduler type', () => {
  assert.equal(getSchedulerPlatform('win32'), 'windows');
  assert.equal(getSchedulerPlatform('darwin'), 'macos');
  assert.equal(getSchedulerPlatform('linux'), 'linux');
});

test('buildWindowsTaskCommand references cli sync', () => {
  const cmd = buildWindowsTaskCommand('C:/Users/me/.config/ckmah/skills/bin/cli.js');
  assert.match(cmd, /cli\.js.*sync --quiet/);
});

test('buildLaunchdPlist contains interval and script path', () => {
  const plist = buildLaunchdPlist('/Users/me/.config/ckmah/skills/bin/cli.js');
  assert.match(plist, /com\.ckmah\.skills\.sync/);
  assert.match(plist, /StartInterval<\/key>\s*<integer>900/);
  assert.match(plist, /<string>sync<\/string>/);
  assert.match(plist, /<string>--quiet<\/string>/);
});

test('buildSystemdTimerUnit schedules every 15 minutes', () => {
  const timer = buildSystemdTimerUnit();
  assert.match(timer, /OnBootSec=1min/);
  assert.match(timer, /OnUnitActiveSec=15min/);
});

test('buildSystemdServiceUnit runs sync quietly', () => {
  const service = buildSystemdServiceUnit('/home/me/.config/ckmah/skills/bin/cli.js');
  assert.match(service, /sync --quiet/);
});
