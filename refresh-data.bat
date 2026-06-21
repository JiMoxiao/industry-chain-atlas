@echo off
setlocal

cd /d "%~dp0"
echo [industry-chain-atlas] Refreshing research data...
PowerShell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0refresh-data.ps1"
set "exit_code=%errorlevel%"

if not "%exit_code%"=="0" (
  echo.
  echo Refresh failed. Review the logs above and try again.
  pause
)

exit /b %exit_code%
