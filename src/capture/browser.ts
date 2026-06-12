// ============================================================
// Playwright browser controller
// Manages browser lifecycle, page navigation, and error handling.
// ============================================================

import { Browser, BrowserContext, Page, chromium } from 'playwright'
import { execSync } from 'child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { detectCaptcha, detectProductNotFound, detectRegionBlock } from './page-parser'
import type { CaptureErrorType } from '../data/types'

export interface PageLoadResult {
  success: true
  html: string
  finalUrl: string
}

export interface PageLoadError {
  success: false
  errorType: CaptureErrorType
  errorMessage: string
}

export type PageLoadOutput = PageLoadResult | PageLoadError

const NAVIGATION_TIMEOUT_MS = 30_000
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

let _browser: Browser | null = null
let _context: BrowserContext | null = null
let _browsersPath: string | null = null

/**
 * Configure where Playwright stores browser binaries.
 * Must be called before getBrowser().
 * In development this is not needed (uses Playwright's default cache).
 * In packaged app, point to userData so the browser persists.
 */
export function setBrowsersPath(dirPath: string): void {
  _browsersPath = dirPath
  process.env.PLAYWRIGHT_BROWSERS_PATH = dirPath
}

/**
 * Ensure Chromium is installed at the configured path.
 * If missing, runs Playwright's CLI to download it.
 * Throws if installation fails.
 */
export async function ensureChromiumInstalled(): Promise<void> {
  const browsersPath = _browsersPath

  if (!browsersPath) {
    // Dev mode — Playwright manages its own cache. Just verify it exists.
    try {
      // Quick probe: can we find the executable?
      chromium.executablePath()
      return // exists
    } catch {
      // Not installed — try CLI install
      runPlaywrightInstall()
      return
    }
  }

  // Packaged app mode — check our managed path
  mkdirSync(browsersPath, { recursive: true })

  const markerFile = join(browsersPath, '.installed')
  if (existsSync(markerFile)) {
    return // Already installed
  }

  // Check if chromium dir actually exists
  const entries = existsSync(browsersPath) ? readdirSync(browsersPath) : []
  if (entries.length > 0) {
    // Has content — assume installed
    return
  }

  // Need to install
  try {
    runPlaywrightInstall()
    // Write marker file
    writeFileSync(markerFile, new Date().toISOString())
  } catch (err) {
    throw new Error(
      `Failed to install Chromium browser. Please ensure you have internet access.\n` +
        `The app needs Chromium to visit Amazon product pages.\n` +
        `You can also install it manually: npx playwright install chromium\n` +
        `Error: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

function runPlaywrightInstall(): void {
  execSync('npx playwright install chromium', {
    stdio: 'pipe',
    timeout: 300_000 // 5 minutes
  })
}

export async function getBrowser(): Promise<{ browser: Browser; context: BrowserContext }> {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
  }

  if (!_context) {
    _context = await _browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1366, height: 768 },
      locale: 'en-US'
    })
  }

  return { browser: _browser, context: _context }
}

export async function closeBrowser(): Promise<void> {
  if (_context) {
    await _context.close()
    _context = null
  }
  if (_browser) {
    await _browser.close()
    _browser = null
  }
}

/**
 * Navigate to a URL and return the fully-loaded HTML.
 * Handles timeouts, network errors, captcha/product-not-found/region-block detection.
 */
export async function loadPage(url: string): Promise<PageLoadOutput> {
  let context: BrowserContext
  try {
    const result = await getBrowser()
    context = result.context
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)

    if (msg.includes('Executable doesn\'t exist') || msg.includes('chromium') && msg.includes('not found')) {
      return {
        success: false,
        errorType: 'UNKNOWN_ERROR',
        errorMessage:
          'Chromium browser is not installed. Go to System > Scheduler and restart, or run: npx playwright install chromium'
      }
    }

    return {
      success: false,
      errorType: 'UNKNOWN_ERROR',
      errorMessage: `Failed to launch browser: ${msg}`
    }
  }

  const page: Page = await context.newPage()

  try {
    // Block images/fonts/media to reduce bandwidth — does not affect Amazon detection
    await page.route('**/*', (route) => {
      const type = route.request().resourceType()
      if (type === 'image' || type === 'font' || type === 'media') {
        return route.abort()
      }
      return route.continue()
    })

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT_MS
    })

    // Wait a bit for dynamic content to settle
    await page.waitForTimeout(2000)

    const finalUrl = page.url()
    const html = await page.content()

    // Check for captcha
    if (detectCaptcha(html, finalUrl)) {
      return {
        success: false,
        errorType: 'CAPTCHA_DETECTED',
        errorMessage: 'Amazon captcha or robot check detected. Automatic capture stopped.'
      }
    }

    // Check for product not found
    if (detectProductNotFound(html)) {
      return {
        success: false,
        errorType: 'PRODUCT_NOT_FOUND',
        errorMessage: 'Product page not found. The ASIN may be invalid or the listing may have been removed.'
      }
    }

    // Check for region block
    if (detectRegionBlock(html)) {
      return {
        success: false,
        errorType: 'REGION_BLOCKED',
        errorMessage: 'This product is not available in your region or cannot be shipped to your location.'
      }
    }

    // Quick parse sanity check — did we get meaningful content?
    if (html.length < 500) {
      return {
        success: false,
        errorType: 'PAGE_LOAD_FAILED',
        errorMessage: 'Page loaded but returned very little content. Amazon may be blocking the request.'
      }
    }

    return { success: true, html, finalUrl }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)

    if (msg.includes('timeout') || msg.includes('Timeout')) {
      return {
        success: false,
        errorType: 'NETWORK_TIMEOUT',
        errorMessage: `Page load timed out after ${NAVIGATION_TIMEOUT_MS / 1000}s`
      }
    }

    return {
      success: false,
      errorType: 'PAGE_LOAD_FAILED',
      errorMessage: `Failed to load page: ${msg}`
    }
  } finally {
    await page.close()
  }
}
