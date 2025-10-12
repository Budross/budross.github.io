@echo off
echo Starting Interactive Grid Tile Game Server...
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python not found. Please install Python 3.x
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Start the server
python server.py

REM Keep window open if server exits unexpectedly
if errorlevel 1 (
    echo.
    echo Server exited with an error.
    pause
)