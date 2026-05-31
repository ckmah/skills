$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$cli = Join-Path $repoRoot 'bin/cli.js'
node $cli sync --quiet

$action = New-ScheduledTaskAction -Execute 'node' -Argument "`"$cli`" sync --quiet"
$triggers = @(
  (New-ScheduledTaskTrigger -AtLogOn),
  (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration ([TimeSpan]::MaxValue))
)
Register-ScheduledTask -TaskName 'CkmahSkillsSync' -Action $action -Trigger $triggers -Force | Out-Null
Write-Output 'Registered CkmahSkillsSync task.'
