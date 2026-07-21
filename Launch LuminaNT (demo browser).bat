@echo off
title LuminaNT demo (browser)
cd /d "%~dp0"

set "PATH=C:\Program Files\nodejs;%PATH%"

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found. Install from https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing npm packages...
  call npm install
)

echo Starting Vite — open the URL shown (usually http://localhost:1420)
echo Use "Load demo data" on the welcome screen.
echo.
call npm run dev
if errorlevel 1 pause
