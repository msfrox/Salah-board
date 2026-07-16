#!/usr/bin/env bash
#
# Salah Board — Linux kiosk installer (Debian/Ubuntu, x86-64).
#
# Turns a minimal Debian install into a single-purpose prayer board:
#   - a systemd service serves display/ over HTTP (deploy/serve.py)
#   - the box auto-logs in on tty1, starts X, and launches Chromium
#     fullscreen at the board, restarting it if it ever crashes
#   - the picture is routed to the external HDMI monitor; the tablet's
#     own panel is switched off
#
# Run it once, from inside the copied repo, as root:
#     sudo bash deploy/linux/install-kiosk.sh
# then reboot. See deploy/README.md for the full walkthrough.

set -euo pipefail

# ---- settings you may want to change --------------------------------------
KIOSK_USER="${KIOSK_USER:-${SUDO_USER:-$USER}}"   # user that auto-logs in
PORT="${PORT:-8080}"
# Pin a zone/language here if you like, e.g. "?zone=11&lang=ta"
# (defaults already give Colombo / Zone 01, English, high-contrast theme)
KIOSK_QUERY="${KIOSK_QUERY:-}"
KIOSK_URL="http://localhost:${PORT}/display/${KIOSK_QUERY}"
# ---------------------------------------------------------------------------

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run with sudo: sudo bash $0" >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
USER_HOME="$(getent passwd "$KIOSK_USER" | cut -d: -f6)"
if [ -z "$USER_HOME" ] || [ ! -d "$USER_HOME" ]; then
  echo "Cannot find home directory for user '$KIOSK_USER'." >&2
  echo "Set KIOSK_USER=<name> and re-run." >&2
  exit 1
fi

echo ">> Repo:        $REPO_DIR"
echo ">> Kiosk user:  $KIOSK_USER ($USER_HOME)"
echo ">> Kiosk URL:   $KIOSK_URL"
echo

echo ">> Installing packages (X, Openbox, Chromium, helpers)..."
export DEBIAN_FRONTEND=noninteractive
DEBS_DIR="${REPO_DIR}/deploy/linux/offline-debs"
if ls "$DEBS_DIR"/*.deb >/dev/null 2>&1; then
  # Offline install: use the .deb bundle staged by fetch-offline-debs.sh, so
  # the tablet never needs internet. Fails clearly if the bundle is missing a
  # dependency (which means it was gathered on a mismatched Debian release).
  echo ">> Installing OFFLINE from ${DEBS_DIR} ($(ls "$DEBS_DIR"/*.deb | wc -l) .debs)"
  apt-get install -y --no-install-recommends "$DEBS_DIR"/*.deb
else
  echo ">> Installing online via apt"
  apt-get update
  apt-get install -y --no-install-recommends \
    xserver-xorg xinit openbox chromium x11-xserver-utils unclutter python3
fi

# Debian ships /usr/bin/chromium; some spins use chromium-browser.
CHROME_BIN="$(command -v chromium || command -v chromium-browser || true)"
if [ -z "$CHROME_BIN" ]; then
  echo "Chromium not found after install. Aborting." >&2
  echo "On Ubuntu the snap build is awkward for kiosks — prefer Debian, or" >&2
  echo "install a .deb Chromium/Chrome and re-run." >&2
  exit 1
fi
echo ">> Chromium:    $CHROME_BIN"

echo ">> Enabling console auto-login on tty1 for $KIOSK_USER..."
install -d /etc/systemd/system/getty@tty1.service.d
cat >/etc/systemd/system/getty@tty1.service.d/autologin.conf <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin ${KIOSK_USER} --noclear %I \$TERM
EOF

echo ">> Starting X automatically after that login..."
BASH_PROFILE="${USER_HOME}/.bash_profile"
if ! grep -q "SALAH_BOARD_KIOSK" "$BASH_PROFILE" 2>/dev/null; then
  cat >>"$BASH_PROFILE" <<'EOF'

# SALAH_BOARD_KIOSK — start the graphical session on the console
if [ -z "${DISPLAY:-}" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec startx -- -nocursor
fi
EOF
fi

echo ">> Writing ~/.xinitrc (launches Openbox)..."
cat >"${USER_HOME}/.xinitrc" <<'EOF'
#!/bin/sh
exec openbox-session
EOF

echo ">> Writing Openbox autostart (screen setup + Chromium loop)..."
install -d "${USER_HOME}/.config/openbox"
cat >"${USER_HOME}/.config/openbox/autostart" <<EOF
# Salah Board kiosk autostart

# Never blank or power down the screen
xset -dpms
xset s off
xset s noblank

# Hide the mouse pointer after 1s idle
unclutter -idle 1 &

# Route the picture to the external (HDMI) monitor and switch off the
# tablet's own panel. Auto-detects output names, so no hardcoding.
# Press Super+P (or Ctrl+Alt+P) any time to switch to the tablet screen and
# back — see deploy/linux/display-toggle.sh.
EXT=\$(xrandr | awk '/ connected/ && !/eDP|LVDS/ {print \$1; exit}')
INT=\$(xrandr | awk '/ connected/ &&  /eDP|LVDS/ {print \$1; exit}')
if [ -n "\$EXT" ]; then
  xrandr --output "\$EXT" --primary --auto
  [ -n "\$INT" ] && xrandr --output "\$INT" --off
  echo external > /tmp/salahboard-display-mode
fi

# Chromium in kiosk mode, restarted automatically if it ever exits/crashes
while true; do
  ${CHROME_BIN} \\
    --kiosk "${KIOSK_URL}" \\
    --incognito --no-first-run --fast --fast-start \\
    --noerrdialogs --disable-infobars \\
    --disable-session-crashed-bubble \\
    --disable-features=Translate \\
    --overscroll-history-navigation=0 \\
    --check-for-update-interval=31536000 \\
    --password-store=basic \\
    --user-data-dir="${USER_HOME}/.config/salahboard-chrome"
  sleep 3
done
EOF

echo ">> Adding a display-switch keybind (Super+P / Ctrl+Alt+P)..."
chmod +x "${REPO_DIR}/deploy/linux/display-toggle.sh" 2>/dev/null || true
OB_RC="${USER_HOME}/.config/openbox/rc.xml"
[ -f "$OB_RC" ] || cp /etc/xdg/openbox/rc.xml "$OB_RC" 2>/dev/null || true
python3 - "$OB_RC" "${REPO_DIR}/deploy/linux/display-toggle.sh" <<'PY'
import sys
rc, script = sys.argv[1], sys.argv[2]
binds = "".join(
    f'''    <keybind key="{k}">
      <action name="Execute"><command>{script}</command></action>
    </keybind>
''' for k in ("W-p", "C-A-p"))
try:
    xml = open(rc).read()
except FileNotFoundError:
    # No default rc.xml present — write a minimal valid one with just the binds
    xml = '<?xml version="1.0"?>\n<openbox_config xmlns="http://openbox.org/3.4/rc">\n  <keyboard>\n  </keyboard>\n</openbox_config>\n'
if "display-toggle.sh" not in xml and "</keyboard>" in xml:
    xml = xml.replace("</keyboard>", binds + "  </keyboard>", 1)
    open(rc, "w").write(xml)
    print("  keybinds added to", rc)
else:
    print("  keybind already present or no <keyboard> section; skipped")
PY

chown -R "${KIOSK_USER}:${KIOSK_USER}" \
  "$BASH_PROFILE" "${USER_HOME}/.xinitrc" "${USER_HOME}/.config"

echo ">> Installing the static-server systemd service..."
sed -e "s#@REPO@#${REPO_DIR}#g" -e "s#@USER@#${KIOSK_USER}#g" \
  "${REPO_DIR}/deploy/linux/salahboard-server.service" \
  >/etc/systemd/system/salahboard-server.service
systemctl daemon-reload
systemctl enable salahboard-server.service
systemctl restart salahboard-server.service

echo
echo ">> Done. Verify the server:  curl -sI http://localhost:${PORT}/display/ | head -1"
echo ">> Then reboot:              sudo reboot"
echo ">> It should come up straight into the fullscreen board on HDMI."
echo ">> Switch to the tablet screen any time with Super+P (or Ctrl+Alt+P)."
