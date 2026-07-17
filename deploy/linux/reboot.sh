#!/usr/bin/env bash
# Salah Board — reboot the board (called by serve.py via sudo -n after an
# in-place update, so the kiosk relaunches on the new code). Run as root.
set -euo pipefail
if command -v systemctl >/dev/null 2>&1; then
  systemctl reboot
else
  /sbin/reboot
fi
