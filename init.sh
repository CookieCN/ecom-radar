#!/usr/bin/env bash
set -e

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

ok() {
  printf "${GREEN}[OK]${NC} %s\n" "$1"
}

warn() {
  printf "${YELLOW}[WARN]${NC} %s\n" "$1"
}

fail() {
  printf "${RED}[ERROR]${NC} %s\n" "$1"
}

echo "Amazon Competitor Radar environment check"
echo

if command -v node >/dev/null 2>&1; then
  ok "Node.js found: $(node --version)"
else
  fail "Node.js is not installed. Install Node.js 20 LTS or newer before development."
fi

if command -v npm >/dev/null 2>&1; then
  ok "npm found: $(npm --version)"
else
  fail "npm is not installed."
fi

if command -v git >/dev/null 2>&1; then
  ok "git found: $(git --version)"
else
  warn "git is not installed or not in PATH."
fi

if [ -f "package.json" ]; then
  ok "package.json found"
  if [ -d "node_modules" ]; then
    ok "node_modules found"
  else
    warn "node_modules not found. Run: npm install"
  fi
else
  warn "package.json not found yet. Next development step is to initialize Electron + Vite + React + TypeScript."
fi

if [ -d ".harness" ]; then
  ok ".harness directory found"
else
  fail ".harness directory is missing."
fi

echo
echo "Common commands after the app scaffold exists:"
echo "  npm install"
echo "  npm run dev"
echo "  npm test"
echo "  npm run lint"
echo "  npm run build"
echo
echo "Before development, read:"
echo "  AGENTS.md"
echo "  .harness/PRD.md"
echo "  .harness/DEVELOPMENT_PLAN.md"
echo "  .harness/ACCEPTANCE.md"

