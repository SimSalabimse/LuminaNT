@echo off
title LuminaNT
cd /d "%~dp0"

REM Ensure Node.js and Rust are on PATH (common install locations)
set "PATH=C:\Program Files\nodejs;%USERPROFILE%\.cargo\bin;%PATH%"

set "EXE=%~dp0src-tauri\target\release\luminant.exe"
set "USE_DEV=0"

REM If no release binary → always dev
if not exist "%EXE%" set "USE_DEV=1"

REM If source UI is newer than the release .exe, the exe is STALE (old look).
REM PowerShell compares mtimes so you always get the latest redesign.
if exist "%EXE%" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$exe = Get-Item -LiteralPath '%EXE%';" ^
    "$srcDirs = @('src','index.html','package.json','tailwind.config.js','vite.config.ts');" ^
    "$newest = $null;" ^
    "foreach ($d in $srcDirs) {" ^
    "  $p = Join-Path '%~dp0' $d;" ^
    "  if (Test-Path $p) {" ^
    "    if ((Get-Item $p) -is [System.IO.DirectoryInfo]) {" ^
    "      $f = Get-ChildItem $p -Recurse -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1;" ^
    "      if ($f -and ($newest -eq $null -or $f.LastWriteTime -gt $newest)) { $newest = $f.LastWriteTime }" ^
    "    } else {" ^
    "      $t = (Get-Item $p).LastWriteTime;" ^
    "      if ($newest -eq $null -or $t -gt $newest) { $newest = $t }" ^
    "    }" ^
    "  }" ^
    "};" ^
    "if ($newest -ne $null -and $newest -gt $exe.LastWriteTime) { exit 2 } else { exit 0 }"
  if errorlevel 2 set "USE_DEV=1"
)

if "%USE_DEV%"=="0" (
  echo Starting LuminaNT release build...
  echo ^(If UI looks old, delete src-tauri\target\release\luminant.exe or run Launch LuminaNT ^(dev^).bat^)
  start "" "%EXE%"
  exit /b 0
)

echo ============================================================
echo  LuminaNT — DEVELOPMENT MODE (latest UI)
echo ============================================================
echo  Release exe missing or OUT OF DATE vs source files.
echo  Starting tauri:dev so you get the newest design.
echo  First start may take a minute.
echo ============================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found. Install from https://nodejs.org
  pause
  exit /b 1
)

REM node_modules may exist but be empty/broken after cleanup — require the Tauri CLI.
if not exist "node_modules\.bin\tauri.cmd" (
  echo Installing npm packages ^(Tauri CLI missing or node_modules incomplete^)...
  if exist "node_modules\" (
    rmdir /s /q "node_modules" 2>nul
  )
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
  if not exist "node_modules\.bin\tauri.cmd" (
    echo ERROR: @tauri-apps/cli still missing after npm install.
    echo Try:  npm install
    pause
    exit /b 1
  )
)

echo Checking for leftover dev server on port 1420...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\free-dev-port.ps1" -Port 1420
echo.

call npm run tauri:dev
if errorlevel 1 (
  echo.
  echo LuminaNT exited with an error.
  echo If you see "Port 1420 is already in use", close the other LuminaNT window
  echo or run:  powershell -File scripts\free-dev-port.ps1
  pause
)
