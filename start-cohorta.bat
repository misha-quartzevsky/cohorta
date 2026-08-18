@echo off
setlocal
cd /d "%~dp0"

title Cohorta - project launcher

echo.
echo ==================================================
echo   Cohorta - automatic project launch
echo ==================================================
echo.

rem ---- 1. Check Node.js ----
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo Install Node.js LTS from https://nodejs.org then run this script again.
  echo.
  pause
  exit /b 1
)
echo [1/5] Node.js: found

rem ---- 2. Check Node version (need 20+) ----
node -e "process.exit(parseInt(process.versions.node.split('.')[0],10) < 20 ? 1 : 0)" >nul 2>nul
if errorlevel 1 (
  echo [WARNING] Node.js is older than 20.
  echo The project targets Node.js 20+. Build may fail on older versions.
  echo.
)

rem ---- 3. Install dependencies ----
echo [2/5] Installing dependencies (npm install)...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo [ERROR] npm install failed.
  echo.
  pause
  exit /b 1
)
pushd apps\web
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo [ERROR] npm install in apps\web failed.
  popd
  echo.
  pause
  exit /b 1
)
popd

rem ---- 4. PocketBase ----
echo [3/5] Checking PocketBase...
if exist "pocketbase\pocketbase.exe" (
  echo       PocketBase already installed.
) else (
  echo       Downloading the latest PocketBase...
  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\download-pocketbase.ps1"
  if errorlevel 1 (
    echo [ERROR] Failed to download PocketBase. Check your internet connection.
    echo.
    pause
    exit /b 1
  )
)

rem ---- 5. Configure .env ----
echo [4/5] Configuring .env...
if exist "apps\web\.env" (
  echo       apps\web\.env already exists.
) else (
  copy /Y "apps\web\.env.example" "apps\web\.env" >nul
  echo       Created apps\web\.env
)

rem ---- 6. Launch ----
echo [5/5] Starting services...
echo.
echo   Frontend:    http://localhost:5173
echo   PocketBase:  http://127.0.0.1:8090   (admin: /_/)
echo.
echo   Demo login:  asyaobraz17@gmail.com
echo   Demo pass:   12345678
echo.
echo   PocketBase starts in a separate window. DO NOT close it.
echo.
echo   Russian instructions: see README-DESIGNER.md
echo.

start "Cohorta PocketBase" cmd /k "npm run pocketbase"

timeout /t 3 /nobreak >nul

call npm run dev