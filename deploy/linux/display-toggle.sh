#!/usr/bin/env bash
#
# Control which screen the board shows on.
#
#   display-toggle.sh              # toggle external <-> tablet (Super+P keybind)
#   display-toggle.sh external     # external HDMI only  (tablet panel off)
#   display-toggle.sh tablet       # tablet panel only   (external off)
#   display-toggle.sh both         # mirror on both (falls back to external)
#
# Bound to Super+P / Ctrl+Alt+P by install-kiosk.sh, and also called by the
# admin panel via serve.py's /api/display/<mode>. Runnable over SSH too:
#   DISPLAY=:0 bash display-toggle.sh tablet

export DISPLAY="${DISPLAY:-:0}"
STATE=/tmp/salahboard-display-mode
MODE="${1:-toggle}"

# Detect the external and internal outputs (internal = eDP/LVDS panel).
EXT=$(xrandr | awk '/ connected/ && !/eDP|LVDS/ {print $1; exit}')
INT=$(xrandr | awk '/ connected/ &&  /eDP|LVDS/ {print $1; exit}')

set_external() { xrandr --output "$EXT" --auto --primary ${INT:+--output "$INT" --off}; echo external > "$STATE"; }
set_tablet()   { xrandr --output "$INT" --auto --primary ${EXT:+--output "$EXT" --off}; echo tablet   > "$STATE"; }
set_both() {
  # Mirror both on a shared mode; if that fails (mismatched resolutions),
  # fall back to external-only so the board is never left blank.
  if xrandr --output "$EXT" --auto --primary --output "$INT" --auto --same-as "$EXT"; then
    echo both > "$STATE"
  else
    set_external
  fi
}

# Resolve "toggle" to a concrete target based on the last known state.
if [ "$MODE" = "toggle" ]; then
  case "$(cat "$STATE" 2>/dev/null)" in
    tablet) MODE=external ;;
    *)      MODE=tablet ;;
  esac
fi

# Handle a missing output gracefully.
[ -z "$EXT" ] && [ "$MODE" != "tablet" ] && MODE=tablet
[ -z "$INT" ] && [ "$MODE" != "external" ] && MODE=external

case "$MODE" in
  external) set_external ;;
  tablet)   set_tablet ;;
  both)     set_both ;;
  *)        echo "unknown mode: $MODE" >&2; exit 1 ;;
esac
