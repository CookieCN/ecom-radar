// ============================================================
// Playwright browser controller
// Manages browser lifecycle, page navigation, and error handling.
// ============================================================

import { Browser, BrowserContext, Page, chromium } from 'playwright'
import { existsSync } from 'fs'
import { detectCaptcha, detectProductNotFound, detectRegionBlock } from './page-parser'
import type { CaptureErrorType } from '../data/types'
import { getMarketplaceConfig, type MarketplaceConfig } from '../shared/marketplaces'

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

export interface NavigationAccessGuard {
  reserve: (
    pageType: string
  ) => { allowed: true; logId: number } | { allowed: false; reason: 'budget' | 'cooldown' }
  complete: (logId: number, result: string, errorType?: string | null) => void
}

export interface AmazonPageSession {
  load: (url: string, pageType: string) => Promise<PageLoadOutput>
  setDeliveryLocation: (deliveryLocation: string) => Promise<{ success: true } | PageLoadError>
  close: () => Promise<void>
}

const NAVIGATION_TIMEOUT_MS = 30_000
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export const DELIVERY_INPUT_SELECTOR = [
  '#GLUXZipUpdateInput',
  '#GLUXCityUpdateInput',
  '[data-action="GLUXPostalInputAction"] input',
  'input[autocomplete="postal-code"]',
  'input[placeholder*="zip" i]',
  'input[aria-label*="zip" i]',
  'input[placeholder*="postal" i]',
  'input[aria-label*="postal" i]'
].join(', ')

export const DELIVERY_SUBMIT_SELECTOR = [
  '#GLUXZipUpdate',
  '#GLUXCityUpdate',
  '[data-action="GLUXPostalUpdateAction"]',
  'button[aria-label*="apply" i]',
  'button[aria-label*="update" i]',
  'input[type="submit"]'
].join(', ')

const DELIVERY_SURFACE_SELECTOR = [
  '.a-popover:visible',
  '.a-popover-wrapper:visible',
  '[role="dialog"]:visible',
  '[data-a-modal-container]:visible',
  '[class*="modal"]:visible'
].join(', ')

let _browser: Browser | null = null

/**
 * Configure where Playwright looks for browser binaries.
 * Must be called before getBrowser().
 *
 * In dev mode: uses Playwright's default cache (user's ms-playwright dir).
 * In packaged app: points to the bundled extraResources/playwright-browsers.
 */
export function setBrowsersPath(dirPath: string): void {
  process.env.PLAYWRIGHT_BROWSERS_PATH = dirPath
}

/**
 * Verify Chromium is accessible. Returns an error message if not, or null if OK.
 */
export function checkChromiumAvailable(): string | null {
  try {
    const exePath = chromium.executablePath()
    if (!existsSync(exePath)) {
      return `Chromium browser not found at: ${exePath}`
    }
    return null // OK
  } catch (err) {
    return `Chromium browser is not installed. Please ensure Playwright Chromium is available.\nError: ${err instanceof Error ? err.message : String(err)}`
  }
}

export async function getBrowser(
  marketplace = 'US'
): Promise<{ browser: Browser; context: BrowserContext }> {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
  }

  // Create a FRESH context for each capture — prevents Amazon from
  // tracking sessions across multiple product page visits
  const config = getMarketplaceConfig(marketplace) ?? getMarketplaceConfig('US')!
  const context = await _browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1366, height: 768 },
    locale: config.locale,
    timezoneId: config.timezoneId
  })

  return { browser: _browser, context }
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close()
    _browser = null
  }
}

/**
 * Navigate to a URL and return the fully-loaded HTML.
 * Handles timeouts, network errors, captcha/product-not-found/region-block detection.
 */
export async function loadPage(
  url: string,
  marketplace: string,
  deliveryLocation: string,
  access?: NavigationAccessGuard
): Promise<PageLoadOutput> {
  const opened = await openAmazonPageSession(marketplace, deliveryLocation, access)
  if ('success' in opened && !opened.success) return opened
  const session = opened as AmazonPageSession
  try {
    const result = await session.load(url, 'product')
    if (!result.success) return result
    if (isNonProductPage(result.html)) {
      return {
        success: false,
        errorType: 'PAGE_LOAD_FAILED',
        errorMessage:
          'Amazon returned a page without product data. This may be a bot detection page. Try again later or use Manual Capture.'
      }
    }
    return result
  } finally {
    await session.close()
  }
}

export async function openAmazonPageSession(
  marketplace: string,
  deliveryLocation: string | null,
  access?: NavigationAccessGuard
): Promise<AmazonPageSession | PageLoadError> {
  let context: BrowserContext
  const config = getMarketplaceConfig(marketplace)
  if (!config) {
    return {
      success: false,
      errorType: 'DELIVERY_LOCATION_FAILED',
      errorMessage: `Unsupported marketplace delivery profile: ${marketplace}`
    }
  }

  try {
    const result = await getBrowser(marketplace)
    context = result.context
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)

    if (
      msg.includes("Executable doesn't exist") ||
      (msg.includes('chromium') && msg.includes('not found'))
    ) {
      return {
        success: false,
        errorType: 'UNKNOWN_ERROR',
        errorMessage:
          'Chromium browser is not installed. The app should have bundled Chromium — please reinstall.'
      }
    }

    return {
      success: false,
      errorType: 'UNKNOWN_ERROR',
      errorMessage: `Failed to launch browser: ${msg}`
    }
  }

  const page: Page = await context.newPage()
  let sessionReady = false

  try {
    // Block images/fonts/media to reduce bandwidth — does not affect Amazon detection
    await page.route('**/*', (route) => {
      const type = route.request().resourceType()
      if (type === 'image' || type === 'font' || type === 'media') {
        return route.abort()
      }
      return route.continue()
    })

    if (deliveryLocation) {
      const deliveryResult = await applyDeliveryLocation(page, config, deliveryLocation, access)
      if (!deliveryResult.success) return deliveryResult
    }
    sessionReady = true
    return {
      load: async (url: string, pageType: string): Promise<PageLoadOutput> => {
        const reservation = access?.reserve(pageType)
        if (reservation && !reservation.allowed) {
          return {
            success: false,
            errorType:
              reservation.reason === 'budget' ? 'PAGE_BUDGET_EXHAUSTED' : 'MARKETPLACE_COOLDOWN',
            errorMessage:
              reservation.reason === 'budget'
                ? 'Daily Amazon page budget exhausted.'
                : 'Amazon marketplace is in risk-control cooldown.'
          }
        }
        const logId = reservation?.allowed ? reservation.logId : null
        try {
          const target = new URL(url)
          target.searchParams.set('currency', config.currency)
          const response = await page.goto(target.toString(), {
            waitUntil: 'domcontentloaded',
            timeout: NAVIGATION_TIMEOUT_MS
          })
          const status = response?.status()
          if (status === 429 || status === 503) {
            const errorType = status === 429 ? 'HTTP_429' : 'HTTP_503'
            if (logId) access?.complete(logId, 'failed', errorType)
            return {
              success: false,
              errorType,
              errorMessage: `Amazon returned HTTP ${status}. Automatic capture stopped.`
            }
          }
          await page.waitForTimeout(2000)
          const finalUrl = page.url()
          const html = await page.content()
          if (detectCaptcha(html, finalUrl)) {
            if (logId) access?.complete(logId, 'failed', 'CAPTCHA_DETECTED')
            return {
              success: false,
              errorType: 'CAPTCHA_DETECTED',
              errorMessage: 'Amazon captcha or robot check detected. Automatic capture stopped.'
            }
          }
          if (detectProductNotFound(html)) {
            if (logId) access?.complete(logId, 'failed', 'PRODUCT_NOT_FOUND')
            return {
              success: false,
              errorType: 'PRODUCT_NOT_FOUND',
              errorMessage: 'Amazon page not found.'
            }
          }
          if (detectRegionBlock(html)) {
            if (logId) access?.complete(logId, 'failed', 'REGION_BLOCKED')
            return {
              success: false,
              errorType: 'REGION_BLOCKED',
              errorMessage: 'This page is not available for the selected delivery location.'
            }
          }
          if (logId) access?.complete(logId, 'success')
          return { success: true, html, finalUrl }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          const errorType = /timeout/i.test(message) ? 'NETWORK_TIMEOUT' : 'PAGE_LOAD_FAILED'
          if (logId) access?.complete(logId, 'failed', errorType)
          return { success: false, errorType, errorMessage: message }
        }
      },
      setDeliveryLocation: (location: string) =>
        applyDeliveryLocation(page, config, location, access),
      close: async () => {
        await page.close().catch(() => {})
        await context.close().catch(() => {})
      }
    }
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
    if (!sessionReady) {
      await page.close().catch(() => {})
      await context.close().catch(() => {})
    }
  }
}

async function applyDeliveryLocation(
  page: Page,
  config: MarketplaceConfig,
  deliveryLocation: string,
  access?: NavigationAccessGuard
): Promise<{ success: true } | PageLoadError> {
  const location = deliveryLocation.trim()
  if (!location) {
    return {
      success: false,
      errorType: 'DELIVERY_LOCATION_FAILED',
      errorMessage: `Delivery location is empty for Amazon ${config.code}. Update it in System settings.`
    }
  }

  let logId: number | null = null
  try {
    const reservation = access?.reserve('delivery_setup')
    if (reservation && !reservation.allowed) {
      return {
        success: false,
        errorType:
          reservation.reason === 'budget' ? 'PAGE_BUDGET_EXHAUSTED' : 'MARKETPLACE_COOLDOWN',
        errorMessage:
          reservation.reason === 'budget'
            ? 'Daily Amazon page budget exhausted.'
            : 'Amazon marketplace is in risk-control cooldown.'
      }
    }
    logId = reservation?.allowed ? reservation.logId : null
    await page.context().addCookies([
      {
        name: 'i18n-prefs',
        value: config.currency,
        domain: `.${config.domain}`,
        path: '/',
        secure: true,
        sameSite: 'Lax'
      }
    ])
    const response = await page.goto(`https://www.${config.domain}`, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT_MS
    })
    if (response?.status() === 429 || response?.status() === 503) {
      const errorType = response.status() === 429 ? 'HTTP_429' : 'HTTP_503'
      if (logId) access?.complete(logId, 'failed', errorType)
      return {
        success: false,
        errorType,
        errorMessage: `Amazon returned HTTP ${response.status()} while setting delivery location.`
      }
    }

    const homeHtml = await page.content()
    if (detectCaptcha(homeHtml, page.url())) {
      if (logId) access?.complete(logId, 'failed', 'CAPTCHA_DETECTED')
      return {
        success: false,
        errorType: 'CAPTCHA_DETECTED',
        errorMessage: 'Amazon captcha or robot check detected while setting delivery location.'
      }
    }

    const rejectCookies = page.locator('#sp-cc-rejectall-link')
    const consentAppeared = await rejectCookies
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false)
    if (consentAppeared) {
      await rejectCookies.click({ timeout: 10_000, noWaitAfter: true })
      await rejectCookies.waitFor({ state: 'hidden', timeout: 10_000 })
      await page.waitForLoadState('domcontentloaded').catch(() => {})
    }

    // Amazon initializes the delivery popover after consent handling.
    await page.waitForTimeout(3_000)

    const locationTrigger = page.locator(
      '#nav-global-location-popover-link, [data-action="a-popover"]#nav-global-location-popover-link'
    )
    await locationTrigger.first().click({ timeout: 10_000 })

    let surface = await findDeliverySurface(page)
    let input = await findVisibleLocator(page, DELIVERY_INPUT_SELECTOR, surface)

    if (!input) {
      const reveal = surface
        ? surface.getByRole('button', {
            name: /enter.*(?:zip|postal)|change|update location|use another/i
          })
        : page.getByRole('button', {
            name: /enter.*(?:zip|postal)|change|update location|use another/i
          })
      const revealButton = await firstVisible(reveal)
      if (revealButton) {
        await revealButton.click({ timeout: 10_000, noWaitAfter: true })
        await page.waitForTimeout(1_000)
        surface = await findDeliverySurface(page)
        input = await findVisibleLocator(page, DELIVERY_INPUT_SELECTOR, surface)
      }
    }

    if (config.code === 'JP') {
      const digits = location.replace(/\D/g, '')
      if (digits.length !== 7) throw new Error('Japan postal code must contain 7 digits')
      await page.locator('#GLUXZipUpdateInput_0').fill(digits.slice(0, 3))
      await page.locator('#GLUXZipUpdateInput_1').fill(digits.slice(3))
    } else {
      input ??= await findFallbackDeliveryInput(page, surface)
      if (!input) {
        const diagnostic = await deliverySurfaceDiagnostic(page, surface)
        throw new Error(`delivery dialog opened but no postal input was found${diagnostic}`)
      }
      await input.fill(location, { timeout: 10_000 })
    }

    let submit = await findVisibleLocator(page, DELIVERY_SUBMIT_SELECTOR, surface)
    if (!submit && surface) {
      submit = await firstVisible(
        surface.getByRole('button', { name: /apply|update|done|submit|use this location/i })
      )
    }
    if (submit) await submit.click({ timeout: 10_000, noWaitAfter: true })
    else if (input) await input.press('Enter')
    else throw new Error('delivery dialog has no submit control')

    const confirmLocation = page.locator('#GLUXConfirmClose:visible').first()
    const confirmationAppeared = await confirmLocation
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false)
    if (confirmationAppeared) {
      await confirmLocation.click({ timeout: 10_000, noWaitAfter: true })
    }
    await page.waitForTimeout(2_000)

    const displayedLocation =
      (await page
        .locator('#glow-ingress-line2')
        .textContent()
        .catch(() => null)) ?? ''
    if (!locationMatches(displayedLocation, location, config.locationMode)) {
      if (logId) access?.complete(logId, 'failed', 'DELIVERY_LOCATION_FAILED')
      return {
        success: false,
        errorType: 'DELIVERY_LOCATION_FAILED',
        errorMessage: `Amazon ${config.code} did not confirm delivery location "${location}". Displayed location: "${displayedLocation.trim() || 'unknown'}".`
      }
    }

    if (logId) access?.complete(logId, 'success')
    return { success: true }
  } catch (err) {
    if (logId) access?.complete(logId, 'failed', 'DELIVERY_LOCATION_FAILED')
    return {
      success: false,
      errorType: 'DELIVERY_LOCATION_FAILED',
      errorMessage: `Could not set Amazon ${config.code} delivery location "${location}": ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

async function findDeliverySurface(page: Page): Promise<ReturnType<Page['locator']> | null> {
  const deadline = Date.now() + 12_000
  while (Date.now() < deadline) {
    const surface = await firstVisible(page.locator(DELIVERY_SURFACE_SELECTOR))
    if (surface) return surface
    const input = await firstVisible(page.locator(DELIVERY_INPUT_SELECTOR))
    if (input) return null
    await page.waitForTimeout(250)
  }
  return null
}

async function findVisibleLocator(
  page: Page,
  selector: string,
  surface: ReturnType<Page['locator']> | null
): Promise<ReturnType<Page['locator']> | null> {
  return firstVisible(surface ? surface.locator(selector) : page.locator(selector))
}

async function findFallbackDeliveryInput(
  page: Page,
  surface: ReturnType<Page['locator']> | null
): Promise<ReturnType<Page['locator']> | null> {
  const root = surface ?? page.locator('body')
  const inputs = root.locator(
    'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not(#twotabsearchtextbox)'
  )
  return firstVisible(inputs)
}

async function firstVisible(
  locator: ReturnType<Page['locator']>
): Promise<ReturnType<Page['locator']> | null> {
  const count = await locator.count()
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index)
    if (await candidate.isVisible().catch(() => false)) return candidate
  }
  return null
}

async function deliverySurfaceDiagnostic(
  page: Page,
  surface: ReturnType<Page['locator']> | null
): Promise<string> {
  const text = await (surface ?? page.locator('body')).innerText().catch(() => '')
  const summary = text.replace(/\s+/g, ' ').trim().slice(0, 240)
  return summary ? `. Dialog text: "${summary}"` : ''
}

function locationMatches(
  displayed: string,
  requested: string,
  mode: MarketplaceConfig['locationMode']
): boolean {
  const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '')
  const actual = normalize(displayed)
  const expected = normalize(requested)
  if (!actual || !expected) return false
  if (mode === 'city') return actual.includes(expected)
  return actual.includes(expected)
}

/**
 * Check if the loaded page is a non-product Amazon page
 * (e.g. access denied, sign-in wall, empty response).
 */
function isNonProductPage(html: string): boolean {
  // No product title element
  if (!/id=["']productTitle["']/i.test(html)) return true
  // No core price element
  if (!/apex-pricetopay-value/i.test(html) && !/corePrice_feature_div/i.test(html)) return true
  // Very short response (likely blocked)
  if (html.length < 2000) return true
  return false
}
