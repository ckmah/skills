#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLI="$REPO_ROOT/bin/cli.js"
SYSTEMD_DIR="$HOME/.config/systemd/user"
mkdir -p "$SYSTEMD_DIR"
cat > "$SYSTEMD_DIR/ckmah-skills-sync.service" <<EOF
[Unit]
Description=ckmah skills sync

[Service]
Type=oneshot
ExecStart=/usr/bin/env node $CLI sync --quiet
EOF
cat > "$SYSTEMD_DIR/ckmah-skills-sync.timer" <<EOF
[Unit]
Description=ckmah skills sync timer

[Timer]
OnBootSec=1min
OnUnitActiveSec=15min
Unit=ckmah-skills-sync.service

[Install]
WantedBy=timers.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now ckmah-skills-sync.timer
echo "Registered systemd user timer"
