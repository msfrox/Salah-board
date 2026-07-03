#!/usr/bin/env bash
# Runs inside reactivecircus/android-emulator-runner's `script:` — which
# executes each YAML line as a separate command, so anything multi-line
# must live here instead.
set -uo pipefail

adb install android/app/build/outputs/apk/debug/app-debug.apk
adb logcat -c
adb shell am start -n lk.salahboard/.MainActivity
sleep 30
adb logcat -d > logcat.txt
adb shell screencap -p /sdcard/screen.png && adb pull /sdcard/screen.png screen.png || true

if ! adb shell pidof lk.salahboard > /dev/null; then
  echo "PROCESS DEAD — crash trace:"
  grep -B 2 -A 60 "FATAL EXCEPTION" logcat.txt || tail -n 200 logcat.txt
  exit 1
fi
echo "PROCESS ALIVE after 30s"

if grep -B 2 -A 40 "FATAL EXCEPTION" logcat.txt; then
  echo "fatal exception found in logcat"
  exit 1
fi
echo "no fatal exceptions in logcat"

# The app catches startup failures and shows them on screen instead of
# dying — so "alive" isn't enough. A crash.log means startup failed even
# though the process survived.
if adb shell run-as lk.salahboard cat files/crash.log 2>/dev/null | grep -q .; then
  echo "STARTUP FAILED — crash.log contents:"
  adb shell run-as lk.salahboard cat files/crash.log
  exit 1
fi
echo "no crash.log — startup genuinely clean"
