# Free Vite/Tauri dev port (default 1420) so launchers can restart cleanly.
param(
  [int]$Port = 1420
)

$ErrorActionPreference = "SilentlyContinue"

function Stop-PortListeners([int]$p) {
  $pids = @()
  try {
    $pids = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
  } catch {}

  # Fallback via netstat if Get-NetTCPConnection unavailable
  if (-not $pids -or $pids.Count -eq 0) {
    $lines = netstat -ano | Select-String ":$p\s+.*LISTENING"
    foreach ($line in $lines) {
      $parts = ($line.ToString() -split "\s+") | Where-Object { $_ -ne "" }
      $id = $parts[-1]
      if ($id -match "^\d+$") { $pids += [int]$id }
    }
    $pids = $pids | Select-Object -Unique
  }

  foreach ($procId in $pids) {
    if (-not $procId -or $procId -eq 0) { continue }
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) {
      Write-Host "Stopping PID $procId ($($proc.ProcessName)) on port $p"
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  }
}

Stop-PortListeners -p $Port

# Optional: stop orphaned app windows from prior tauri:dev
Get-Process -Name luminant -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host "Stopping $($_.ProcessName) PID $($_.Id)"
  Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Milliseconds 400

$still = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($still) {
  Write-Host "WARNING: Port $Port still in use after cleanup."
  exit 1
}

Write-Host "Port $Port is free."
exit 0
