export function getSchedulerPlatform(platform = process.platform) {
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'macos';
  return 'linux';
}

export function buildWindowsTaskCommand(cliPath) {
  const nodeCli = `node "${cliPath.replace(/\//g, '\\')}" sync --quiet`;
  return `$action = New-ScheduledTaskAction -Execute 'node' -Argument '"${cliPath.replace(/\\/g, '\\\\')}" sync --quiet'; Register-ScheduledTask -TaskName 'CkmahSkillsSync' -Action $action -Trigger (New-ScheduledTaskTrigger -AtLogOn), (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration ([TimeSpan]::MaxValue)) -Force; ${nodeCli}`;
}

export function buildLaunchdPlist(cliPath) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.ckmah.skills.sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>node</string>
    <string>${cliPath}</string>
    <string>sync</string>
    <string>--quiet</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>900</integer>
</dict>
</plist>`;
}

export function buildSystemdServiceUnit(cliPath) {
  return `[Unit]
Description=ckmah skills sync

[Service]
Type=oneshot
ExecStart=/usr/bin/node ${cliPath} sync --quiet

[Install]
WantedBy=default.target
`;
}

export function buildSystemdTimerUnit() {
  return `[Unit]
Description=ckmah skills sync timer

[Timer]
OnBootSec=1min
OnUnitActiveSec=15min
Unit=ckmah-skills-sync.service

[Install]
WantedBy=timers.target
`;
}

export function schedulerInstallScript(platform, repoDir) {
  const cliPath = `${repoDir.replace(/\\/g, '/')}/bin/cli.js`;
  switch (platform) {
    case 'windows':
      return { type: 'powershell', content: buildWindowsTaskCommand(cliPath) };
    case 'macos':
      return { type: 'launchd', path: '~/Library/LaunchAgents/com.ckmah.skills.sync.plist', content: buildLaunchdPlist(cliPath) };
    default:
      return {
        type: 'systemd',
        servicePath: '~/.config/systemd/user/ckmah-skills-sync.service',
        timerPath: '~/.config/systemd/user/ckmah-skills-sync.timer',
        service: buildSystemdServiceUnit(cliPath),
        timer: buildSystemdTimerUnit(),
      };
  }
}
