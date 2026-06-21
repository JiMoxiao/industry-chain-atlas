$ErrorActionPreference = "Stop"

param(
  [switch]$HeatOnly
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendBase = "http://127.0.0.1:8001"

function Wait-ForJobCompletion {
  param([string]$StatusUrl)

  while ($true) {
    $status = Invoke-RestMethod -Uri $StatusUrl -Method Get
    if (-not $status.running) {
      return $status
    }
    Start-Sleep -Seconds 3
  }
}

Set-Location $projectRoot

try {
  $health = Invoke-RestMethod -Uri "$backendBase/api/health" -Method Get
  if ($null -ne $health) {
    if ($HeatOnly) {
      Invoke-RestMethod -Uri "$backendBase/api/jobs/refresh-heat" -Method Post | Out-Null
    } else {
      Invoke-RestMethod -Uri "$backendBase/api/jobs/refresh" -Method Post | Out-Null
    }

    $finalStatus = Wait-ForJobCompletion -StatusUrl "$backendBase/api/jobs/status"
    $finalStatus
    exit 0
  }
} catch {
  Write-Host "后端未运行，回退到本地脚本模式..."
}

python .\update_heat.py
if (-not $HeatOnly) {
  python .\snapshot.py --all
}
python .\generate_data.py --all
