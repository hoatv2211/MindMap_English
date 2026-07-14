@echo off
setlocal
cd /d "%~dp0"

set "HOST=127.0.0.1"
set "PORT=15000"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js chua duoc cai dat hoac khong co trong PATH.
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm chua duoc cai dat hoac khong co trong PATH.
  exit /b 1
)

if not exist "node_modules\" (
  echo [SETUP] Dang cai dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

echo [BUILD] Dang build ung dung...
call npm run build
if errorlevel 1 exit /b 1

echo [RUN] MindMap English: http://%HOST%:%PORT%
echo [STOP] Nhan Ctrl+C de dung server.
call npm start
set "EXIT_CODE=%ERRORLEVEL%"

endlocal & exit /b %EXIT_CODE%