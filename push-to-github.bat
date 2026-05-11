@echo off
REM Push Telegram-Commerce-Bot to GitHub (Windows version)
REM
REM Instructions:
REM   1. Edit GITHUB_USER and REPO_NAME below
REM   2. Create an empty repo on github.com first (no README, no .gitignore)
REM   3. Double-click this file, or run from cmd inside the extracted folder

REM === EDIT THESE TWO LINES ===
set GITHUB_USER=zyamy
set REPO_NAME=telegram-commerce-bot
REM ============================

if not exist package.json (
  echo ERROR: Run this from inside the Telegram-Commerce-Bot folder.
  pause
  exit /b 1
)

echo ==^> Initializing git repository
if exist .git rmdir /s /q .git
git init -b main
if errorlevel 1 goto :fail

echo ==^> Staging files
git add .

echo ==^> Creating commit
git commit -m "Migrate from Replit to Railway"

echo ==^> Adding remote
git remote add origin https://github.com/%GITHUB_USER%/%REPO_NAME%.git

echo ==^> Pushing to GitHub
git push -u origin main
if errorlevel 1 goto :fail

echo.
echo Done. Next: railway.app -^> New Project -^> Deploy from GitHub repo
echo Then: Settings -^> Root Directory = artifacts/admin-panel
pause
exit /b 0

:fail
echo.
echo Something went wrong. Check the error above.
pause
exit /b 1
