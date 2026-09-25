@echo off
chcp 65001 >nul
title Nova Residence - lokal server
cd /d "%~dp0"
echo.
echo  Nova Residence lokal olaraq ishe salinir...
echo  Bu pencereni baglamayin. Saytdan chixmaq uchun pencereni baglayin.
echo.

where node >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8080
  npx --yes http-server -p 8080 -c-1 .
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8080
  python -m http.server 8080
  goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8080
  py -m http.server 8080
  goto :eof
)

echo  XETA: Kompyuterde Node.js ve ya Python tapilmadi.
echo  Birini qurashdirin: https://nodejs.org (tovsiye olunur) ve ya https://www.python.org
echo  Sonra bu fayli yeniden ishe salin.
pause
