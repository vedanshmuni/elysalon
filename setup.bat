@echo off
REM SalonOS Development Setup Script for Windows

echo ========================================
echo SalonOS - Quick Setup Script
echo ========================================
echo.

REM Check if Node.js is installed
echo [1/6] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)
node --version
echo Node.js found!
echo.

REM Check if .env.local exists
echo [2/6] Checking environment configuration...
if exist .env.local (
    echo .env.local already exists
) else (
    if exist .env.example (
        echo Creating .env.local from .env.example...
        copy .env.example .env.local >nul
        echo.
        echo IMPORTANT: Please edit .env.local and add your Supabase credentials!
        echo.
    ) else (
        echo ERROR: .env.example not found!
        exit /b 1
    )
)
echo.

REM Install dependencies
echo [3/6] Installing dependencies...
echo This may take a few minutes...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies!
    exit /b 1
)
echo Dependencies installed successfully!
echo.

REM Type check
echo [4/6] Running type check...
call npm run type-check
if %errorlevel% neq 0 (
    echo WARNING: Type check failed. Please review errors above.
) else (
    echo Type check passed!
)
echo.

REM Lint
echo [5/6] Running linter...
call npm run lint
if %errorlevel% neq 0 (
    echo WARNING: Linting issues found. Please review above.
) else (
    echo Linting passed!
)
echo.

REM Build check
echo [6/6] Testing build...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed! Please check for errors above.
    echo Make sure your .env.local has valid Supabase credentials.
    exit /b 1
)
echo Build successful!
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Edit .env.local with your Supabase credentials
echo 2. Apply database migrations in Supabase SQL Editor
echo 3. Run: npm run dev
echo 4. Visit: http://localhost:3000
echo.
echo For detailed instructions, see QUICKSTART.md
echo ========================================

pause
