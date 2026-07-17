#!/usr/bin/env bash
#
# Salah Board — auto-switch the screen when the HDMI monitor is (un)plugged.
#
# The board normally shows on the external HDMI monitor with the tablet's own
# panel switched off. If someone unplugs the HDMI cable, X keeps drawing to a
# now-dark output until a key is pressed — the picture appears to freeze/vanish.
# This watcher notices the hotplug and switches the picture to the tablet panel,
# and switches back to HDMI when it is replugged. Each switch goes through
# display-toggle.sh, whose `xrandr --auto` re-applies the target output's native
# mode; the display's CSS is viewport-relative (vmin × --sb-scale) so it reflows
# to the new resolution on its own once Chromium's kiosk window resizes.
#
# Started in the background from the Openbox autostart (install-kiosk.sh). Runs
# as the kiosk user inside the X session — no root needed. Polls xrandr because
# DRM/udev hotplug events don't reliably reach an ordinary X client.

export DISPLAY="${DISPLAY:-:0}"
TOGGLE="$(cd "$(dirname "$0")" && pwd)/display-toggle.sh"

# Same detection display-toggle.sh uses: an external = a connected output that
# isn't the internal eDP/LVDS panel. Empty when the HDMI cable is out.
ext_connected() {
  local e
  e="$(xrandr 2>/dev/null | awk '/ connected/ && !/eDP|LVDS/ {print $1; exit}')"
  [ -n "$e" ]
}

# Seed with the current state so we only act on a CHANGE, never on startup
# (the autostart has already set the initial mode).
if ext_connected; then last=1; else last=0; fi

while sleep 2; do
  if ext_connected; then cur=1; else cur=0; fi
  [ "$cur" = "$last" ] && continue
  last="$cur"
  if [ "$cur" = 1 ]; then
    bash "$TOGGLE" external   # HDMI back → return to the main monitor
  else
    bash "$TOGGLE" tablet     # HDMI gone → fall back to the tablet panel
  fi
done
