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

Start-Process -WindowStyle Hidden -FilePath 'python' -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', "$BackendPort") -WorkingDirectory $backendPath | Out-Null
# Invoke the Windows command shim explicitly so PowerShell does not resolve npm.ps1.
Start-Process -WindowStyle Hidden -FilePath 'npm.cmd' -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1', '--port', "$FrontendPort") -WorkingDirectory $frontendPath | Out-Null

Write-Host "邻里智护已启动："
Write-Host "前端：http://127.0.0.1:$FrontendPort/login"
Write-Host "API 文档：http://127.0.0.1:$BackendPort/docs"
Write-Host "停止服务：.\stop.ps1 -BackendPort $BackendPort -FrontendPort $FrontendPort"
