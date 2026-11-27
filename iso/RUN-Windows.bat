@echo off
cd /d "%~dp0"
where python >/dev/null 2>nul
if %errorlevel%==0 ( python serve.py ) else ( echo Python not found - opening index.html directly. & start "" "%~dp0index.html" & pause )
