$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $projectRoot ".dbg\runtime"
$backendPidFile = Join-Path $runtimeDir "backend.pid"
$frontendPidFile = Join-Path $runtimeDir "frontend.pid"

function Stop-ManagedProcess {
  param(
    [string]$Name,
    [string]$PidFile
  )

  if (-not (Test-Path $PidFile)) {
    Write-Host ("{0}: no managed process found." -f $Name)
    return
  }

  $rawPid = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
  if (-not $rawPid) {
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    Write-Host ("{0}: empty pid file removed." -f $Name)
    return
  }

  try {
    $processId = [int]$rawPid
    Get-Process -Id $processId -ErrorAction Stop | Out-Null
    & taskkill /PID $processId /T /F | Out-Null
    Write-Host ("{0}: stopped, PID={1}" -f $Name, $processId)
  } catch {
    Write-Host ("{0}: process not found, stale pid file removed." -f $Name)
  }

  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

Stop-ManagedProcess -Name "backend" -PidFile $backendPidFile
Stop-ManagedProcess -Name "frontend" -PidFile $frontendPidFile
