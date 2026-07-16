@echo off
REM Salah Board — Windows kiosk launcher.
REM Starts the static server (minimised) then opens Microsoft Edge in
REM fullscreen kiosk mode at the board. Edge ships with Windows 10/11, so
REM nothing to install except Python (see deploy/windows/README-windows.md).
REM
REM Put a shortcut to this file in the Startup folder to auto-launch on login.

setlocal
set PORT=8080
REM Pin a zone/language if you like, e.g.  set QUERY=?zone=11^&lang=ta
set QUERY=

REM Start the static server minimised, from deploy\serve.py
start "salahboard-server" /min python "%~dp0..\serve.py" %PORT%

REM Give the server a moment to bind the port
timeout /t 2 /nobreak >nul

REM Launch Edge in true kiosk mode (fullscreen, no chrome, auto-recover off)
start "" msedge.exe --kiosk "http://localhost:%PORT%/display/%QUERY%" ^
  --edge-kiosk-type=fullscreen ^
  --no-first-run ^
  --disable-features=msEdgeCrashRecoveryBubble,Translate ^
  --overscroll-history-navigation=0

endlocal
