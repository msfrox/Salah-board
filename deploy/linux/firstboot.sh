#!/usr/bin/env bash
#
# Runs once on the first boot after an automated (preseed) install:
# waits for the network, runs the kiosk installer, disables itself,
# and reboots into the board. Logs everything for debugging.
#
# Safe to run by hand too:  sudo bash deploy/linux/firstboot.sh

LOG=/var/log/salahboard-firstboot.log
exec >>"$LOG" 2>&1
echo "=== firstboot $(date -Is) ==="

REPO=/home/board/Salah-board

# Wait up to ~3 min for the network (WiFi configured during install should
# reconnect on its own).
for _ in $(seq 1 60); do
  if getent hosts deb.debian.org >/dev/null 2>&1; then
    echo "network up"; break
  fi
  sleep 3
done

cd "$REPO" || { echo "repo not found at $REPO — aborting"; exit 1; }
git pull --ff-only || echo "git pull skipped/failed — using cloned copy"

# Run the kiosk installer as the auto-login user 'board'.
KIOSK_USER=board bash deploy/linux/install-kiosk.sh
rc=$?
echo "install-kiosk.sh exited with $rc"

# Don't run again on subsequent boots.
systemctl disable salahboard-firstboot.service || true

if [ "$rc" -eq 0 ]; then
  echo "=== firstboot done, rebooting into the board ==="
  reboot
else
  echo "=== firstboot FAILED (rc=$rc). Log in and run: sudo bash $REPO/deploy/linux/install-kiosk.sh ==="
fi
