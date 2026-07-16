#!/usr/bin/env bash
#
# Salah Board — WiFi hotspot control via NetworkManager (nmcli).
#
# Lets the admin panel turn the board's own WiFi access point on/off and set
# its name + password, so a caretaker can join the board's hotspot from any
# phone and open the settings even where there is no other WiFi.
#
# Called by deploy/serve.py through `sudo -n` (install-kiosk.sh adds the
# sudoers drop-in). Run as root. Manages a single NM connection profile named
# "salahboard-hotspot" so repeated edits never pile up stray profiles.
#
# Usage:
#   hotspot.sh status                 -> JSON: available/active/ssid/password
#   hotspot.sh start                  -> bring the hotspot up
#   hotspot.sh stop                   -> bring the hotspot down
#   hotspot.sh config <ssid> <psk>    -> set name+password (>=8 chars) and start
set -euo pipefail

CON="salahboard-hotspot"

# Minimal JSON string escaper (backslash + double-quote + control chars).
jesc() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr -d '\000-\037'; }

have_nmcli() { command -v nmcli >/dev/null 2>&1; }

wifi_dev() {
  nmcli -t -f DEVICE,TYPE device 2>/dev/null | awk -F: '$2=="wifi"{print $1; exit}'
}

is_active() {
  nmcli -t -f NAME connection show --active 2>/dev/null | grep -qx "$CON"
}

emit_status() {
  if ! have_nmcli; then
    printf '{"available":false,"active":false,"error":"NetworkManager (nmcli) not installed"}\n'
    return
  fi
  local dev ssid psk active
  dev="$(wifi_dev || true)"
  if [ -z "$dev" ]; then
    printf '{"available":false,"active":false,"error":"no WiFi adapter found"}\n'
    return
  fi
  ssid="$(nmcli -s -g 802-11-wireless.ssid connection show "$CON" 2>/dev/null || true)"
  psk="$(nmcli -s -g 802-11-wireless-security.psk connection show "$CON" 2>/dev/null || true)"
  if is_active; then active=true; else active=false; fi
  printf '{"available":true,"active":%s,"iface":"%s","ssid":"%s","password":"%s"}\n' \
    "$active" "$(jesc "$dev")" "$(jesc "$ssid")" "$(jesc "$psk")"
}

ensure_profile() {
  # Create the profile if missing; caller sets ssid/psk via `config`.
  local dev="$1"
  if ! nmcli -t -f NAME connection show 2>/dev/null | grep -qx "$CON"; then
    nmcli connection add type wifi ifname "$dev" con-name "$CON" \
      autoconnect no ssid "SalahBoard" >/dev/null
    nmcli connection modify "$CON" \
      802-11-wireless.mode ap 802-11-wireless.band bg \
      ipv4.method shared \
      802-11-wireless-security.key-mgmt wpa-psk \
      802-11-wireless-security.psk "salahboard" >/dev/null
  fi
}

cmd="${1:-status}"
case "$cmd" in
  status)
    emit_status
    ;;
  start)
    have_nmcli || { echo "nmcli not installed" >&2; exit 1; }
    dev="$(wifi_dev)"; [ -n "$dev" ] || { echo "no WiFi adapter" >&2; exit 1; }
    ensure_profile "$dev"
    nmcli connection up "$CON" >/dev/null
    echo "hotspot up"
    ;;
  stop)
    have_nmcli || { echo "nmcli not installed" >&2; exit 1; }
    nmcli connection down "$CON" >/dev/null 2>&1 || true
    echo "hotspot down"
    ;;
  config)
    have_nmcli || { echo "nmcli not installed" >&2; exit 1; }
    ssid="${2:-}"; psk="${3:-}"
    [ -n "$ssid" ] || { echo "ssid required" >&2; exit 1; }
    [ "${#psk}" -ge 8 ] || { echo "password must be at least 8 characters" >&2; exit 1; }
    dev="$(wifi_dev)"; [ -n "$dev" ] || { echo "no WiFi adapter" >&2; exit 1; }
    ensure_profile "$dev"
    nmcli connection modify "$CON" \
      802-11-wireless.ssid "$ssid" \
      802-11-wireless-security.key-mgmt wpa-psk \
      802-11-wireless-security.psk "$psk" >/dev/null
    nmcli connection up "$CON" >/dev/null
    echo "hotspot configured and up"
    ;;
  *)
    echo "usage: hotspot.sh {status|start|stop|config <ssid> <psk>}" >&2
    exit 2
    ;;
esac
