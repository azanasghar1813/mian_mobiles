@echo off
title MIAN MOBILES POS Server (PC 1)
color 0A
echo ========================================================
echo        STARTING MIAN MOBILES POS SYSTEM
echo ========================================================
echo.
echo Starting backend server on Shop LAN...
cd /d "%~dp0\.."
node backend\src\server.js
pause
