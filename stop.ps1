param(
  [int]$BackendPort = 8000,
  [int]$FrontendPort = 5173
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendPath = (Join-Path $root 'frontend').TrimEnd('\')
$ports = @($BackendPort, $FrontendPort) | Select-Object -Unique
$frontendPattern = [regex]::Escape($frontendPath)

function Add-TargetProcess {
  param([int]$ProcessId)
  if ($script:targetIds -notcontains $ProcessId) {
    $script:targetIds += $ProcessId
  }
}

function Is-ProjectProcess {
  param(
    [object]$ProcessInfo,
    [int]$Port
  )

  if (-not $ProcessInfo) { return $false }
  $commandLine = [string]$ProcessInfo.CommandLine
  if ($Port -eq $BackendPort) {
    return $commandLine -match '(?i)python(?:\.exe)?["'']?\s+.*-m\s+uvicorn\s+app\.main:app'
  }
  return ($commandLine -match '(?i)(?:vite|npm-cli\.js\s+run\s+dev)') -and ($commandLine -match $frontendPattern)
}

function Get-ProcessMap {
  $map = @{}
  Get-CimInstance Win32_Process | ForEach-Object {
    $map[[int]$_.ProcessId] = $_
  }
  return $map
}

$targetIds = @()
$processMap = Get-ProcessMap
$connections = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {
  $_.LocalPort -in $ports -and $_.OwningProcess -gt 0
})

foreach ($connection in $connections) {
  $processId = [int]$connection.OwningProcess
  $processInfo = $processMap[$processId]
  if (Is-ProjectProcess -ProcessInfo $processInfo -Port ([int]$connection.LocalPort)) {
    Add-TargetProcess -ProcessId $processId
  } else {
    Write-Warning ("端口 {0} 当前由其他进程占用，已跳过 PID {1}。" -f $connection.LocalPort, $processId)
  }
}

# npm keeps the Vite child alive. Include only the direct npm ancestor of a
# matched Vite process so another project's Node process is never selected.
foreach ($processId in @($targetIds)) {
  $processInfo = $processMap[$processId]
  if (-not $processInfo) { continue }
  $parentId = [int]$processInfo.ParentProcessId
  $parentInfo = $processMap[$parentId]
  if ($parentInfo -and ([string]$parentInfo.CommandLine -match '(?i)npm-cli\.js\s+run\s+dev')) {
    Add-TargetProcess -ProcessId $parentId
  }
}

if ($targetIds.Count -eq 0) {
  Write-Host "没有发现邻里智护正在运行的服务。"
  exit 0
}

foreach ($processId in ($targetIds | Sort-Object -Descending)) {
  try {
    Stop-Process -Id $processId -Force -ErrorAction Stop
    Write-Host ("已停止 PID {0}" -f $processId)
  } catch {
    Write-Warning ("无法停止 PID {0}：{1}" -f $processId, $_.Exception.Message)
  }
}

Start-Sleep -Milliseconds 250
$remaining = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in $ports })
if ($remaining.Count -gt 0) {
  $remainingPorts = ($remaining | Select-Object -ExpandProperty LocalPort -Unique) -join ', '
  Write-Warning "以下端口仍在监听：$remainingPorts。请检查占用它们的其他服务。"
  exit 1
}

Write-Host "邻里智护已停止。"
