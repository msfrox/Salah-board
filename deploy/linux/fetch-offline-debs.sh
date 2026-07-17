#!/usr/bin/env bash
#
# Pre-download every .deb the kiosk needs, so the tablet can be set up with
# NO internet at all. Run this ONCE on an internet-connected Debian machine
# that matches the tablet's release/architecture (Debian 13 "trixie", amd64):
#
#     bash deploy/linux/fetch-offline-debs.sh
#
# It fills deploy/linux/offline-debs/ with the packages + their full
# dependency closure. Copy that whole repo folder onto your install media
# (USB/CD). On the tablet, install-kiosk.sh auto-detects the folder and
# installs from it offline — no apt network access required.
#
# NOTE: gather these on the SAME Debian release as the tablet, or a
# dependency version may not match and the offline install will complain.

set -euo pipefail

DEST="$(cd "$(dirname "$0")" && pwd)/offline-debs"
PKGS="xserver-xorg xinit openbox chromium x11-xserver-utils unclutter python3 network-manager dnsmasq-base"

mkdir -p "$DEST"
cd "$DEST"

echo ">> Resolving the full dependency list for:"
echo "   $PKGS"
DEPS=$(apt-cache depends --recurse --no-recommends --no-suggests \
  --no-conflicts --no-breaks --no-replaces --no-enhances $PKGS \
  | grep '^[[:alnum:]]' | sort -u)

count=$(echo "$DEPS" | wc -l)
echo ">> Downloading up to $count packages into $DEST ..."
ok=0
for p in $DEPS; do
  if apt-get download "$p" 2>/dev/null; then
    ok=$((ok + 1))
  else
    echo "   (skipped virtual/unavailable: $p)"
  fi
done

echo ">> Done: $(ls -1 "$DEST"/*.deb 2>/dev/null | wc -l) .deb files, $(du -sh "$DEST" | cut -f1) total."
echo ">> Copy the repo (including deploy/linux/offline-debs/) onto the tablet's"
echo ">> install media; install-kiosk.sh will use it automatically."
