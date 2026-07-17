#!/usr/bin/env bash
#
# Salah Board — set the system clock from the admin panel (offline RTC fix).
#
# The display normally corrects small drift with a display-only offset
# (config.time.offsetMs, no privileges needed). This helper is the heavier
# option: actually set the OS clock, for a board with no internet whose RTC
# has drifted. Called by deploy/serve.py via `sudo -n`; run as root.
#
# Usage: settime.sh <ISO>     e.g. settime.sh 2026-07-17T14:03:25
#
# Turns off automatic NTP first (set-time refuses while NTP owns the clock).
# On a board WITH internet, prefer leaving NTP on and using the display offset.
set -euo pipefail

iso="${1:-}"
# Strict validation — this string is handed to timedatectl as root.
if ! printf '%s' "$iso" | grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}$'; then
  echo "bad time format (want YYYY-MM-DDTHH:MM:SS)" >&2
  exit 1
fi

when="${iso/T/ }"   # timedatectl wants "YYYY-MM-DD HH:MM:SS"

if command -v timedatectl >/dev/null 2>&1; then
  timedatectl set-ntp false >/dev/null 2>&1 || true
  timedatectl set-time "$when"
else
  date -s "$when" >/dev/null
fi
echo "clock set to $when"
