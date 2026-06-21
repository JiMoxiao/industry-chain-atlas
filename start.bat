@echo off
setlocal

cd /d "%~dp0"
echo [industry-chain-atlas] Starting services...
PowerShell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
set "exit_code=%errorlevel%"

if not "%exit_code%"=="0" (
  echo.
  echo Startup failed. Review the logs above and try again.
  pause
)

exit /b %exit_code%
