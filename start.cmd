@echo off
setlocal
cd /d "%~dp0"
set "demoNode=node"
where node >nul 2>nul
if errorlevel 1 set "demoNode=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "node_modules\qrcode" (
  echo Dependencies missing. Install Node.js and run: npm install --ignore-scripts
  pause
  exit /b 1
)
echo Open http://localhost:3080 in your browser.
echo Keep this window open while presenting. Press Ctrl+C to stop.
"%demoNode%" server.cjs
pause
