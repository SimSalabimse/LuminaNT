@echo off
title LuminaNT (dev)
cd /d "%~dp0"

set "PATH=C:\Program Files\nodejs;%USERPROFILE%\.cargo\bin;%PATH%"

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

echo Freeing port 1420 if needed...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\free-dev-port.ps1" -Port 1420
echo.

echo Starting LuminaNT in development mode...
call npm run tauri:dev
if errorlevel 1 (
  echo.
  echo Dev server exited with an error.
  echo Tip: close any other LuminaNT / Vite windows, then try again.
  pause
)
