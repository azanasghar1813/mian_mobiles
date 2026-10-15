@echo off
title MIAN MOBILES POS - Safety Backup
echo ========================================================
echo        CREATING SAFETY DATABASE BACKUP
echo ========================================================
echo.
set TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

if not exist "%~dp0..\backend\backups" mkdir "%~dp0..\backend\backups"

copy "%~dp0..\backend\data\mian_mobiles.db" "%~dp0..\backend\backups\manual_backup_%TIMESTAMP%.db"

echo.
echo Database backup saved to: backend\backups\manual_backup_%TIMESTAMP%.db
echo.
pause
