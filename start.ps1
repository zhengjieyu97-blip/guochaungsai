param(
  [int]$BackendPort = 8000,
  [int]$FrontendPort = 5173
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $root 'backend'
$frontendPath = Join-Path $root 'frontend'

$env:PYTHONPATH = $backendPath
$env:NEIGHBOR_CARE_FRONTEND_ORIGINS = "http://127.0.0.1:$FrontendPort,http://localhost:$FrontendPort"

$python = (Get-Command python -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$ports = @($BackendPort, $FrontendPort) | Select-Object -Unique
$occupied = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in $ports })
if ($occupied.Count -gt 0) {
  $occupiedPorts = ($occupied | Select-Object -ExpandProperty LocalPort -Unique) -join ', '
  throw "Ports $occupiedPorts are already in use. Run .\stop.ps1 first or choose different ports."
}

$backendProcess = $null
$frontendProcess = $null

function Wait-Endpoint {
  param(
    [string]$Url,
    [string]$Label,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        Write-Host ("[ready] {0}: {1}" -f $Label, $Url) -ForegroundColor Green
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  return $false
}

try {
  $backendProcess = Start-Process -NoNewWindow -PassThru -FilePath $python `
    -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', "$BackendPort", '--log-level', 'info') `
    -WorkingDirectory $backendPath
  # Invoke the Windows command shim explicitly so PowerShell does not resolve npm.ps1.
  $frontendProcess = Start-Process -NoNewWindow -PassThru -FilePath $npm `
    -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1', '--port', "$FrontendPort") `
    -WorkingDirectory $frontendPath

  Write-Host "Neighbor Care foreground mode started:" -ForegroundColor Cyan
  Write-Host ("Backend PID {0} - http://127.0.0.1:{1}/docs" -f $backendProcess.Id, $BackendPort)
  Write-Host ("Frontend PID {0} - http://127.0.0.1:{1}/login" -f $frontendProcess.Id, $FrontendPort)
  Write-Host "Backend request logs and frontend dev-server logs will stay visible below."
  Write-Host "Stop: open another terminal and run .\stop.ps1; Ctrl+C ends this monitor." -ForegroundColor Yellow

  $backendReady = Wait-Endpoint -Url "http://127.0.0.1:$BackendPort/api/health" -Label 'backend'
  $frontendReady = Wait-Endpoint -Url "http://127.0.0.1:$FrontendPort/login" -Label 'frontend'
  if (-not $backendReady -or -not $frontendReady) {
    throw "Services did not become ready within 30 seconds. Check the startup logs above."
  }

  while ($true) {
    Start-Sleep -Seconds 1
    if ($backendProcess.HasExited) {
      Write-Warning "The backend process exited with code $($backendProcess.ExitCode). The monitor is ending and the frontend will stop."
      break
    }
    if ($frontendProcess.HasExited) {
      Write-Warning "The frontend process exited with code $($frontendProcess.ExitCode). The monitor is ending and the backend will stop."
      break
    }
  }
} finally {
  foreach ($process in @($frontendProcess, $backendProcess)) {
    if ($process -and -not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
}
