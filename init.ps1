$ErrorActionPreference = "Stop"

function Write-Ok($message) {
  Write-Host "[OK] $message" -ForegroundColor Green
}

function Write-Warn($message) {
  Write-Host "[WARN] $message" -ForegroundColor Yellow
}

function Write-Fail($message) {
  Write-Host "[ERROR] $message" -ForegroundColor Red
}

Write-Host "Amazon Competitor Radar environment check"
Write-Host ""

try {
  $nodeVersion = node --version
  Write-Ok "Node.js found: $nodeVersion"
} catch {
  Write-Fail "Node.js is not installed. Install Node.js 20 LTS or newer before development."
}

try {
  $npmVersion = npm --version
  Write-Ok "npm found: $npmVersion"
} catch {
  Write-Fail "npm is not installed."
}

try {
  $gitVersion = git --version
  Write-Ok "git found: $gitVersion"
} catch {
  Write-Warn "git is not installed or not in PATH."
}

if (Test-Path "package.json") {
  Write-Ok "package.json found"
  if (Test-Path "node_modules") {
    Write-Ok "node_modules found"
  } else {
    Write-Warn "node_modules not found. Run: npm install"
  }
} else {
  Write-Warn "package.json not found yet. Next development step is to initialize Electron + Vite + React + TypeScript."
}

if (Test-Path ".harness") {
  Write-Ok ".harness directory found"
} else {
  Write-Fail ".harness directory is missing."
}

Write-Host ""
Write-Host "Common commands after the app scaffold exists:"
Write-Host "  npm install"
Write-Host "  npm run dev"
Write-Host "  npm test"
Write-Host "  npm run lint"
Write-Host "  npm run build"
Write-Host ""
Write-Host "Before development, read:"
Write-Host "  AGENTS.md"
Write-Host "  .harness/PRD.md"
Write-Host "  .harness/DEVELOPMENT_PLAN.md"
Write-Host "  .harness/ACCEPTANCE.md"

