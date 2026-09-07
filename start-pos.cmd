@echo off
cd /d "%~dp0"
start "BreadFlow POS Server" /min node node_modules\next\dist\bin\next dev
timeout /t 3 /nobreak >nul
start "" http://localhost:3000
