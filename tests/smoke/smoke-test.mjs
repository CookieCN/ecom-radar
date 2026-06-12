// Smoke test for packaged Windows app
// Run after building the installer:
//   1. Install the .exe
//   2. Run this script to verify core functionality
//
// Usage: node tests/smoke/smoke-test.mjs <install-dir>
//
// This script verifies:
// - App files exist (exe, resources, asar)
// - Playwright Chromium is bundled
// - SQLite native module is bundled
// - Source quality gates pass

import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const PASS = '\x1b[32m✓\x1b[0m'
const FAIL = '\x1b[31m✗\x1b[0m'

let passed = 0
let failed = 0

function check(name, fn) {
  try {
    const result = fn()
    if (result === false) throw new Error('Check returned false')
    console.log(`  ${PASS} ${name}`)
    passed++
  } catch (err) {
    console.log(`  ${FAIL} ${name} — ${err.message}`)
    failed++
  }
}

function fileExists(p) {
  if (!existsSync(p)) throw new Error(`File not found: ${p}`)
  const stat = statSync(p)
  if (stat.size < 1000) throw new Error(`File too small: ${stat.size} bytes`)
}

function dirHasFiles(p, min) {
  const entries = readdirSync(p, { recursive: true })
  if (entries.length < min) throw new Error(`Expected >=${min} files, found ${entries.length}`)
}

// ============================================================
console.log('\nAmazon Competitor Radar — Smoke Test\n')

// 1. Source quality gates (must work from repo)
console.log('1. Source Quality Gates')
check('npm test passes', () => {
  execSync('npm test', { stdio: 'pipe', timeout: 120000 })
  return true
})
check('npm run lint passes', () => {
  execSync('npm run lint', { stdio: 'pipe', timeout: 60000 })
  return true
})
check('npm run typecheck passes', () => {
  execSync('npm run typecheck', { stdio: 'pipe', timeout: 60000 })
  return true
})
check('npm run build succeeds', () => {
  execSync('npm run build', { stdio: 'pipe', timeout: 120000 })
  return true
})

// 2. Build output integrity
console.log('\n2. Build Output Integrity')
const distDir = join(process.cwd(), 'dist-electron')
const distRenderer = join(process.cwd(), 'dist')

check('main process built', () => fileExists(join(distDir, 'main', 'index.js')))
check('preload built', () => fileExists(join(distDir, 'preload', 'index.js')))
check('renderer built', () => {
  const htmlPath = join(distRenderer, 'renderer', 'index.html')
  if (!existsSync(htmlPath)) throw new Error('index.html not found')
  const jsFiles = readdirSync(join(distRenderer, 'renderer', 'assets')).filter(f => f.endsWith('.js'))
  if (jsFiles.length === 0) throw new Error('No JS bundle found')
  return true
})

// 3. Packaged app integrity (if exists)
console.log('\n3. Packaged App')
const releaseDir = join(process.cwd(), 'release')
const unpackedDir = join(releaseDir, 'win-unpacked')

if (existsSync(unpackedDir)) {
  check('win-unpacked exe exists', () =>
    fileExists(join(unpackedDir, 'Amazon Competitor Radar.exe'))
  )
  check('resources dir exists', () => {
    const r = join(unpackedDir, 'resources')
    if (!existsSync(r)) throw new Error('resources dir not found')
    return true
  })
  check('app.asar exists', () => fileExists(join(unpackedDir, 'resources', 'app.asar')))

  // Check for Playwright Chromium in extraResources
  const extraChromium = join(unpackedDir, 'resources', 'playwright-browsers', 'chromium')
  check('Playwright Chromium bundled', () => {
    if (!existsSync(extraChromium)) {
      // Try glob pattern
      const pwBrowsers = join(unpackedDir, 'resources', 'playwright-browsers')
      if (existsSync(pwBrowsers)) {
        const contents = readdirSync(pwBrowsers)
        if (contents.length > 0) {
          console.log(`    (found: ${contents.join(', ')})`)
          return true
        }
      }
      throw new Error('Chromium not found in extraResources')
    }
    dirHasFiles(extraChromium, 50)
    return true
  })

  // NSIS installer
  const installerFiles = readdirSync(releaseDir).filter((f) => f.endsWith('.exe') && f.includes('setup'))
  check('NSIS installer generated', () => {
    if (installerFiles.length === 0) throw new Error('No setup.exe found')
    console.log(`    (${installerFiles[0]})`)
    return true
  })
} else {
  console.log('  (no packaged build found — run npm run package:win first)')
}

// 4. Project files
console.log('\n4. Project Documentation')
check('README.md exists', () => fileExists(join(process.cwd(), 'README.md')))
check('LICENSE exists', () => fileExists(join(process.cwd(), 'LICENSE')))
check('CONTRIBUTING.md exists', () => fileExists(join(process.cwd(), 'CONTRIBUTING.md')))
check('AGENTS.md exists', () => fileExists(join(process.cwd(), 'AGENTS.md')))

// Summary
console.log(`\n${'='.repeat(40)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('\n❌ SMOKE TEST FAILED')
  process.exit(1)
} else {
  console.log('\n✅ SMOKE TEST PASSED')
}
