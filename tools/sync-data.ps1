# Syncs ACJU timetable data into display/data/
# Source 1: sibling repo (E:\GitHub\Prayer Time Site) if present
# Source 2: https://pray.gear.lk/data/ (download)
$ErrorActionPreference = "Stop"
$dest = Join-Path $PSScriptRoot "..\display\data"
$src  = Join-Path $PSScriptRoot "..\..\Prayer Time Site\data"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

if (Test-Path $src) {
  Copy-Item (Join-Path $src "zone*.json") $dest -Force
  Copy-Item (Join-Path $src "zones.json") $dest -Force
  Write-Host "Synced from local Prayer Time Site repo."
} else {
  Write-Host "Sibling repo not found - downloading from pray.gear.lk ..."
  foreach ($z in 1..13) {
    foreach ($m in 1..12) {
      $f = "zone{0:00}-{1:00}.json" -f $z, $m
      Invoke-WebRequest "https://pray.gear.lk/data/$f" -OutFile (Join-Path $dest $f) | Out-Null
    }
  }
  Invoke-WebRequest "https://pray.gear.lk/data/zones.json" -OutFile (Join-Path $dest "zones.json") | Out-Null
  Write-Host "Downloaded 157 files."
}
Write-Host ("Files in display/data: " + (Get-ChildItem $dest -Filter *.json).Count)
