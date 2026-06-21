@echo off
setlocal

cd /d "%~dp0"
echo [industry-chain-atlas] Stopping managed services...
PowerShell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1"
set "exit_code=%errorlevel%"

if not "%exit_code%"=="0" (
  echo.
  echo Stop failed. Review the logs above and try again.
  pause
)

exit /b %exit_code%
