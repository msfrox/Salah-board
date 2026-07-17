#!/usr/bin/env bash
#
# Salah Board — join an EXISTING WiFi network from the admin panel (nmcli).
#
# The hotspot helper (hotspot.sh) turns the board INTO an access point; this one
# does the opposite — connects the board to a normal WiFi network a caretaker
# picks in the admin "Network" tab. Scanning is read-only and handled directly
# in serve.py (no privilege needed); only `connect` lives here because changing
# the active connection needs root.
#
# Called by deploy/serve.py through `sudo -n` (install-kiosk.sh adds the sudoers
# drop-in). Run as root.
#
# Usage:
#   wifi.sh connect <ssid> [password]   -> join it (open network if no password)
#
# Note: the board has a single WiFi radio, so joining a network drops the
# hotspot (and any SSH you were on over that hotspot). That is expected.
set -euo pipefail

have_nmcli() { command -v nmcli >/dev/null 2>&1; }

wifi_dev() {
  nmcli -t -f DEVICE,TYPE device 2>/dev/null | awk -F: '$2=="wifi"{print $1; exit}'
}

cmd="${1:-}"
case "$cmd" in
  connect)
    have_nmcli || { echo "nmcli not installed" >&2; exit 1; }
    ssid="${2:-}"; psk="${3:-}"
    [ -n "$ssid" ] || { echo "ssid required" >&2; exit 1; }
    dev="$(wifi_dev)"; [ -n "$dev" ] || { echo "no WiFi adapter found on this device" >&2; exit 1; }
    if [ -n "$psk" ]; then
      nmcli device wifi connect "$ssid" password "$psk" ifname "$dev"
    else
      nmcli device wifi connect "$ssid" ifname "$dev"
    fi
    ;;
  *)
    echo "usage: wifi.sh connect <ssid> [password]" >&2
    exit 2
    ;;
esac
