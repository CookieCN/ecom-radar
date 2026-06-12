// Copies Playwright Chromium browser from local cache into resources/
// so electron-builder can bundle it with the app.
// Run before electron-builder: node scripts/bundle-playwright.mjs

import { execSync } from 'child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const resourcesDir = join(rootDir, 'resources', 'playwright-browsers')

// Find Playwright's Chromium executable path
let chromiumPath
try {
  // Use node -e to get the path (avoids import issues)
  const result = execSync('node -e "const {chromium}=require(\'playwright\');console.log(chromium.executablePath())"', {
    cwd: rootDir,
    encoding: 'utf-8'
  }).trim()
  chromiumPath = result
  console.log('Found Chromium at:', chromiumPath)
} catch (err) {
  console.error('Playwright Chromium not found. Run: npx playwright install chromium')
  console.error(err.message)
  process.exit(1)
}

// The executable is at: .../ms-playwright/chromium-1223/chrome-win64/chrome.exe
// We need the parent of chrome-win64 (the chromium-XXXX directory)
const chromeDir = dirname(chromiumPath) // chrome-win64/
const chromiumVersionDir = dirname(chromeDir) // chromium-1223/

console.log('Chromium version dir:', chromiumVersionDir)

// Clear previous
if (existsSync(resourcesDir)) {
  rmSync(resourcesDir, { recursive: true })
}
mkdirSync(resourcesDir, { recursive: true })

// Copy the chromium version directory
const destDir = join(resourcesDir, 'chromium')
console.log('Copying to:', destDir)
cpSync(chromiumVersionDir, destDir, { recursive: true })

console.log('Done. Chromium bundled for packaging.')
