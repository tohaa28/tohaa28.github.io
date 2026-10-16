@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  echo Starting GWB Vector Bridge on 127.0.0.1:14762...
  start "GWB Vector Bridge" /min py -3 "%~dp0gwb-vector-bridge.py" --serve
  exit /b 0
)
where python >nul 2>nul
if %errorlevel%==0 (
  echo Starting GWB Vector Bridge on 127.0.0.1:14762...
  start "GWB Vector Bridge" /min python "%~dp0gwb-vector-bridge.py" --serve
  exit /b 0
)
echo Python 3 not found. Install Python 3 for Windows and try again.
echo You may always edit using the manual export/return buttons in Maketnaya.
pause
exit /b 1
