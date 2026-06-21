@echo off
setlocal

cd /d "%~dp0"
echo [industry-chain-atlas] Refreshing heat cache...
PowerShell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0refresh-data.ps1" -HeatOnly
set "exit_code=%errorlevel%"

if not "%exit_code%"=="0" (
  echo.
  echo Heat refresh failed. Review the logs above and try again.
  pause
)

exit /b %exit_code%
