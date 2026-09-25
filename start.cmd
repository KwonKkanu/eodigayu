@echo off
setlocal
cd /d "%~dp0"
if not exist "server.cjs" goto missing_files
if not exist "package.json" goto missing_files
set "demoNode=node"
where node >nul 2>nul
if errorlevel 1 set "demoNode=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%demoNode%" --version >nul 2>nul
if errorlevel 1 goto missing_node
"%demoNode%" -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)"
if errorlevel 1 goto old_node
if not exist "node_modules\qrcode" goto install_packages
"%demoNode%" -e "require('qrcode')" >nul 2>nul
if not errorlevel 1 goto run_demo
:install_packages
echo [Setup] Installing required packages. The first run needs internet access.
where npm.cmd >nul 2>nul
if not errorlevel 1 goto install_npm
where pnpm.cmd >nul 2>nul
if not errorlevel 1 goto install_pnpm
echo [ERROR] npm was not found. Install Node.js LTS including npm.
goto install_help

:install_npm
call npm.cmd install --ignore-scripts --no-audit --no-fund
if errorlevel 1 goto install_failed
goto check_packages

:install_pnpm
call pnpm.cmd install --ignore-scripts --prefer-offline
if errorlevel 1 goto install_failed

:check_packages
"%demoNode%" -e "require('qrcode')" >nul 2>nul
if errorlevel 1 goto install_failed

:run_demo
if not defined PORT set "PORT=3080"
echo.
echo Open http://localhost:%PORT% in your browser after the server starts.
echo Keep this window open while presenting. Press Ctrl+C to stop.
"%demoNode%" server.cjs
if errorlevel 1 goto server_failed
exit /b 0

:missing_node
echo [ERROR] Node.js is not installed or cannot be found.
goto install_help

:old_node
echo [ERROR] Node.js 18 or newer is required. Install a current LTS release.

:install_help
echo Download Node.js LTS with npm from https://nodejs.org/
echo After installation, close this window and run start.cmd again.
goto failed

:missing_files
echo [ERROR] Project files are missing.
echo Extract the entire downloaded ZIP before running start.cmd.
goto failed

:install_failed
echo.
echo [ERROR] Package installation failed. Read the error above.
echo Check your internet connection and run start.cmd again.
goto failed

:server_failed
echo.
echo [ERROR] The server could not start. Read the error above.
echo If it says EADDRINUSE, another server already uses this port.
echo Open its browser address or close the previous server window.

:failed
pause
exit /b 1
