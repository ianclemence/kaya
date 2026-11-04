#!/usr/bin/env bash
#
# Install the room climate bridge as a systemd service so it starts with the
# Pod and keeps the sensor inbox fed.
#
#   sudo scripts/room-climate/install.sh

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST=/usr/local/lib/kaya/room-climate
UNIT=/etc/systemd/system/kaya-room-climate.service
WS="${KAYA_WORKSPACE_DIR:-/var/lib/kaya/workspace}"

[[ $EUID -eq 0 ]] || { echo "run with sudo" >&2; exit 1; }
[[ -d "$WS" ]] || { echo "Kaya workspace not found: $WS" >&2; exit 1; }

install -d -m 0755 "$DEST"
install -m 0644 "$DIR/room-climate-bridge.py" "$DEST/room-climate-bridge.py"
install -m 0644 "$DIR/kaya-room-climate.service" "$UNIT"

mkdir -p "$WS/state/sensors"

systemctl daemon-reload
systemctl enable --now kaya-room-climate.service
sleep 2
systemctl --no-pager -l status kaya-room-climate.service | head -12
echo
echo "installed. watch readings with:"
echo "  journalctl -u kaya-room-climate -f"
echo "  cat $WS/state/room-climate.json"
