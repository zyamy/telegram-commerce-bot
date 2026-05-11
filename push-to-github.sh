#!/usr/bin/env bash
# Push Telegram-Commerce-Bot to GitHub (one-shot)
# Usage:
#   1. Edit GITHUB_USER and REPO_NAME below
#   2. Make sure you've created an empty repo on github.com first
#   3. Run from inside the extracted Telegram-Commerce-Bot folder:
#        bash push-to-github.sh

set -e

# === EDIT THESE TWO LINES ===
GITHUB_USER="your-username"
REPO_NAME="telegram-commerce-bot"
# ============================

if [ ! -f package.json ] || [ ! -d artifacts ]; then
  echo "ERROR: Run this script from inside the Telegram-Commerce-Bot folder."
  exit 1
fi

echo "==> Initializing git repository"
rm -rf .git
git init -b main
git config user.email "$(git config --global user.email || echo you@example.com)"
git config user.name  "$(git config --global user.name  || echo You)"

echo "==> Staging files"
git add .

echo "==> Creating commit"
git commit -m "Migrate from Replit to Railway

- Add artifacts/admin-panel/railway.toml + nixpacks.toml
- Add server.mjs (zero-dep static server for production)
- Make Replit vite plugins optional (load only when REPL_ID is set)
- Remove hardcoded PORT/BASE_PATH from build script
- Add RAILWAY.md deployment guide"

echo "==> Adding remote: https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
git remote add origin "https://github.com/${GITHUB_USER}/${REPO_NAME}.git" 2>/dev/null || \
  git remote set-url origin "https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

echo "==> Pushing to GitHub"
git push -u origin main

echo ""
echo "Done. Next steps:"
echo "  1. Open https://railway.app  →  New Project  →  Deploy from GitHub repo"
echo "  2. Pick ${REPO_NAME}"
echo "  3. Settings  →  Root Directory  =  artifacts/admin-panel"
echo "  4. Networking  →  Generate Domain"
