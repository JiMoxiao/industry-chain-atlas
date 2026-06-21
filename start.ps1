$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPort = 8001
$frontendPort = 5173
$runtimeDir = Join-Path $projectRoot ".dbg\runtime"
$logDir = Join-Path $runtimeDir "logs"
$backendPidFile = Join-Path $runtimeDir "backend.pid"
$frontendPidFile = Join-Path $runtimeDir "frontend.pid"
$backendOutLog = Join-Path $logDir "backend.out.log"
$backendErrLog = Join-Path $logDir "backend.err.log"
$frontendOutLog = Join-Path $logDir "frontend.out.log"
$frontendErrLog = Join-Path $logDir "frontend.err.log"

function Ensure-Directory {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Remove-FileIfExists {
  param([string]$Path)

  if (Test-Path $Path) {
    try {
      Remove-Item $Path -Force
    } catch {
      # ignore locked log files; new output will continue to append
    }
  }
}

function Stop-ProcessFromPidFile {
  param([string]$PidFile)

  if (-not (Test-Path $PidFile)) {
    return
  }

  $rawPid = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
  if (-not $rawPid) {
    Remove-FileIfExists $PidFile
    return
  }

  try {
    $processId = [int]$rawPid
    Get-Process -Id $processId -ErrorAction Stop | Out-Null
    & taskkill /PID $processId /T /F | Out-Null
  } catch {
    # ignore stale pid files
  }

  Remove-FileIfExists $PidFile
}

function Start-HiddenProcess {
  param(
    [string]$FilePath,
    [string]$WorkingDirectory,
    [string[]]$Arguments,
    [string]$StdoutLog,
    [string]$StderrLog
  )

  Remove-FileIfExists $StdoutLog
  Remove-FileIfExists $StderrLog

  return Start-Process `
    -FilePath $FilePath `
    -WorkingDirectory $WorkingDirectory `
    -ArgumentList $Arguments `
    -RedirectStandardOutput $StdoutLog `
    -RedirectStandardError $StderrLog `
    -WindowStyle Hidden `
    -PassThru
}

Ensure-Directory $runtimeDir
Ensure-Directory $logDir

Stop-ProcessFromPidFile $backendPidFile
Stop-ProcessFromPidFile $frontendPidFile

Write-Host "[1/4] Install backend dependencies..."
Set-Location $projectRoot
python -m pip install -r ".\backend\requirements.txt"

Write-Host "[2/4] Check frontend dependencies..."
if (-not (Test-Path ".\web\node_modules")) {
  Set-Location ".\web"
  pnpm install
  Set-Location $projectRoot
}

Write-Host "[3/4] Generate frontend data..."
python .\generate_data.py --all

Write-Host "[4/4] Start backend and frontend in background..."
$backendProcess = Start-HiddenProcess `
  -FilePath "python" `
  -WorkingDirectory $projectRoot `
  -Arguments @("-m", "uvicorn", "backend.main:app", "--reload", "--host", "127.0.0.1", "--port", "$backendPort") `
  -StdoutLog $backendOutLog `
  -StderrLog $backendErrLog

Set-Content -Path $backendPidFile -Value $backendProcess.Id

Start-Sleep -Seconds 2

$frontendProcess = Start-HiddenProcess `
  -FilePath "pnpm.cmd" `
  -WorkingDirectory (Join-Path $projectRoot "web") `
  -Arguments @("dev", "--host", "127.0.0.1", "--port", "$frontendPort") `
  -StdoutLog $frontendOutLog `
  -StderrLog $frontendErrLog

Set-Content -Path $frontendPidFile -Value $frontendProcess.Id

Start-Sleep -Seconds 2
Start-Process "http://localhost:$frontendPort/"

Write-Host ("Started in background: frontend=http://localhost:{0}/ backend=http://127.0.0.1:{1}/" -f $frontendPort, $backendPort)
Write-Host ("Backend log: {0}" -f $backendOutLog)
Write-Host ("Frontend log: {0}" -f $frontendOutLog)
