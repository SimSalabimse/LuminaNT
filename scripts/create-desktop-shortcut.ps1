# Creates a Desktop shortcut to "Launch LuminaNT.bat"
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$bat = Join-Path $root "Launch LuminaNT.bat"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "LuminaNT.lnk"

if (-not (Test-Path $bat)) {
  Write-Error "Launcher not found: $bat"
}

$icon = Join-Path $root "src-tauri\icons\icon.ico"
$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($shortcutPath)
$sc.TargetPath = $bat
$sc.WorkingDirectory = $root
$sc.Description = "LuminaNT - NT Betting Tracker companion"
if (Test-Path $icon) {
  $sc.IconLocation = "$icon,0"
}
$sc.Save()

Write-Host "Desktop shortcut created: $shortcutPath"
Write-Host "Double-click LuminaNT on your Desktop to launch."
