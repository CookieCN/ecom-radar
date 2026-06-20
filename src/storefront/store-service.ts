import Database from 'better-sqlite3'
import { getDeliverySettingKey, getMarketplaceConfig } from '../shared/marketplaces'
import { SettingsRepository } from '../data/repositories/settings'
import { SellerStoresRepository } from '../data/repositories/seller_stores'
import type { SellerStore, SellerStoreProduct } from '../data/types'
import { PageBudgetService } from '../monitoring/page-budget'
import {
  openAmazonPageSession,
  type AmazonPageSession,
  type NavigationAccessGuard
} from '../capture/browser'
import { parseProductPage } from '../capture/page-parser'
import { parseStoreListing, parseStoreProfile, type ParsedStoreProductCard } from './store-parser'

const STORE_LIST_PAGES_PER_DAY = 3
const STORE_DETAILS_PER_DAY = 5
const MIN_PAGE_DELAY_MS = 2 * 60 * 1000
const MAX_PAGE_DELAY_MS = 5 * 60 * 1000

export interface StoreScanResult {
  success: boolean
  deferred?: boolean
  scannedProducts: number
  deepProducts: number
  errorType?: string
  errorMessage?: string
}

export interface StoreScanRuntime {
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

export async function scanSellerStore(
  db: Database.Database,
  store: SellerStore,
  runtime: StoreScanRuntime = {}
): Promise<StoreScanResult> {
  const repo = new SellerStoresRepository(db)
  const budget = new PageBudgetService(db)
  const config = getMarketplaceConfig(store.marketplace)
  if (!config) return failure(repo, store, 'PAGE_LOAD_FAILED', 'Unsupported marketplace.')
  const cooldown = budget.getCooldown(store.marketplace)
  if (cooldown) {
    repo.updateJob(store.id, nextMorning(), `cooldown:${cooldown.reason}`)
    return {
      success: false,
      deferred: true,
      scannedProducts: 0,
      deepProducts: 0,
      errorType: 'MARKETPLACE_COOLDOWN',
      errorMessage: cooldown.reason
    }
  }

  const access: NavigationAccessGuard = {
    reserve: (pageType) => budget.reserve(store.marketplace, pageType, 'seller_store', store.id),
    complete: (logId, result, errorType) => {
      budget.complete(logId, result, errorType ?? null)
      if (errorType) budget.registerRisk(store.marketplace, errorType)
    }
  }
  const delivery = new SettingsRepository(db).getOrDefault(
    getDeliverySettingKey(config.code),
    config.defaultLocation
  )
  // Store identity and catalog discovery remain useful when Amazon's location
  // dialog is unavailable. Verified delivery context is required only for
  // product-detail price and availability enrichment.
  const opened = await openAmazonPageSession(store.marketplace, null, access)
  if ('success' in opened && !opened.success) {
    if (
      opened.errorType === 'PAGE_BUDGET_EXHAUSTED' ||
      opened.errorType === 'MARKETPLACE_COOLDOWN'
    ) {
      repo.updateJob(store.id, nextMorning(), opened.errorType)
      return {
        success: false,
        deferred: true,
        scannedProducts: 0,
        deepProducts: 0,
        errorType: opened.errorType ?? undefined,
        errorMessage: opened.errorMessage
      }
    }
    if (opened.errorType) budget.registerRisk(store.marketplace, opened.errorType)
    return failure(repo, store, opened.errorType ?? 'PAGE_LOAD_FAILED', opened.errorMessage)
  }

  const session = opened as AmazonPageSession
  const sleep = runtime.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const random = runtime.random ?? Math.random
  const wait = async (): Promise<void> =>
    sleep(Math.floor(MIN_PAGE_DELAY_MS + random() * (MAX_PAGE_DELAY_MS - MIN_PAGE_DELAY_MS)))
  const capturedAt = new Date().toISOString()
  let profile = parseStoreProfile('')
  let profileOk = false
  const scannedPages = [1, store.rotation_page, store.rotation_page + 1]
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, STORE_LIST_PAGES_PER_DAY)
  const cards: Array<ParsedStoreProductCard & { page: number }> = []
  let reportedCount: number | null = null
  let completeListing = true
  let deepProducts = 0
  let deepErrorType: string | null = null
  let deepErrorMessage: string | null = null

  try {
    const profileResult = await session.load(store.profile_url, 'store_profile')
    if (profileResult.success) {
      profile = parseStoreProfile(profileResult.html)
      profileOk = true
      repo.update(store.id, {
        name: profile.name ?? store.name,
        logo_url: profile.logoUrl ?? store.logo_url
      })
    } else {
      if (isDeferred(profileResult.errorType))
        return defer(repo, store, profileResult.errorType!, profileResult.errorMessage)
      if (isRisk(profileResult.errorType))
        return riskFailure(
          repo,
          budget,
          store,
          profileResult.errorType!,
          profileResult.errorMessage
        )
    }

    for (const pageNumber of scannedPages) {
      await wait()
      const url = new URL(store.storefront_url)
      url.searchParams.set('page', String(pageNumber))
      const result = await session.load(url.toString(), 'store_listing')
      if (!result.success) {
        completeListing = false
        if (isDeferred(result.errorType))
          return defer(repo, store, result.errorType!, result.errorMessage)
        if (isRisk(result.errorType))
          return riskFailure(repo, budget, store, result.errorType!, result.errorMessage)
        continue
      }
      const listing = parseStoreListing(result.html)
      if (pageNumber === 1) reportedCount = listing.reportedProductCount
      cards.push(...listing.products.map((card) => ({ ...card, page: pageNumber })))
    }

    const unique = new Map<string, ParsedStoreProductCard & { page: number }>()
    for (const card of cards) unique.set(card.asin, card)
    const newProducts: SellerStoreProduct[] = []
    for (const card of unique.values()) {
      const previous = repo.findProduct(store.id, card.asin)
      const changedPrice =
        previous?.listing_price != null &&
        card.price != null &&
        previous.listing_price !== card.price
      const result = repo.upsertVisibleProduct(store.id, {
        asin: card.asin,
        title: card.title,
        image_url: card.imageUrl,
        listing_price: null,
        currency: null,
        rating: card.rating,
        review_count: card.reviewCount,
        captured_at: capturedAt,
        page: card.page
      })
      if (result.isNew) {
        repo.createEvent(store.id, result.product.id, 'new_visible', null, card.asin)
        newProducts.push(result.product)
      } else if (result.restored) {
        repo.createEvent(store.id, result.product.id, 'restored')
      }
      if (changedPrice)
        repo.createEvent(
          store.id,
          result.product.id,
          'price_changed',
          String(previous!.listing_price),
          String(card.price)
        )
    }

    if (completeListing) {
      const missing = repo.markMissing(store.id, [...unique.keys()], scannedPages, capturedAt)
      for (const product of missing) repo.createEvent(store.id, product.id, 'suspected_missing')
    }

    const candidates = selectDeepCandidates(repo.listProducts(store.id), newProducts)
    if (candidates.length > 0) {
      const deliveryResult = await session.setDeliveryLocation(delivery)
      if (!deliveryResult.success) {
        deepErrorType = deliveryResult.errorType ?? 'DELIVERY_LOCATION_FAILED'
        deepErrorMessage = deliveryResult.errorMessage
        if (isRisk(deliveryResult.errorType)) {
          budget.registerRisk(store.marketplace, deliveryResult.errorType!)
        }
      } else {
        for (const product of candidates.slice(0, STORE_DETAILS_PER_DAY)) {
          await wait()
          const result = await session.load(
            `https://www.${config.domain}/dp/${product.asin}`,
            'store_product_detail'
          )
          if (!result.success) {
            if (isDeferred(result.errorType) || isRisk(result.errorType)) {
              deepErrorType = result.errorType
              deepErrorMessage = result.errorMessage
              if (isRisk(result.errorType)) {
                budget.registerRisk(store.marketplace, result.errorType!)
              }
              break
            }
            continue
          }
          const detail = parseProductPage(result.html, result.finalUrl)
          repo.updateDetail(
            product.id,
            {
              detail_price: detail.price,
              regular_price: detail.regularPrice,
              list_price: detail.listPrice,
              availability: detail.availability,
              coupon: extractText(
                result.html,
                /(?:coupon|Gutschein|クーポン)[^>]{0,200}>\s*([^<]{1,80})</i
              ),
              deal_type: detail.priceType
            },
            capturedAt
          )
          deepProducts += 1
        }
      }
    }

    const captureStatus =
      profileOk && completeListing && !deepErrorType
        ? 'success'
        : cards.length
          ? 'partial'
          : 'failed'
    repo.createSnapshot({
      store_id: store.id,
      public_rating: profile.publicRating,
      feedback_count: profile.feedbackCount,
      positive_30d: profile.positive30d,
      positive_90d: profile.positive90d,
      positive_365d: profile.positive365d,
      reported_product_count: reportedCount,
      scanned_product_count: unique.size,
      captured_at: capturedAt,
      capture_status: captureStatus,
      error_type: captureStatus === 'success' ? null : (deepErrorType ?? 'PARSER_FAILED'),
      error_message:
        captureStatus === 'success'
          ? null
          : (deepErrorMessage ?? 'One or more seller pages could not be parsed.')
    })
    repo.update(store.id, {
      rotation_page: cards.filter((card) => card.page === store.rotation_page + 1).length
        ? store.rotation_page + 2
        : 2,
      consecutive_failures: captureStatus === 'failed' ? store.consecutive_failures + 1 : 0,
      status:
        captureStatus === 'failed' && store.consecutive_failures + 1 >= 3 ? 'paused' : 'active'
    })
    repo.updateJob(store.id, nextMorning(), null)
    return {
      success: captureStatus !== 'failed',
      scannedProducts: unique.size,
      deepProducts,
      errorType: deepErrorType ?? undefined,
      errorMessage: deepErrorMessage ?? undefined
    }
  } finally {
    await session.close()
  }
}

function selectDeepCandidates(
  products: SellerStoreProduct[],
  newlyAdded: SellerStoreProduct[]
): SellerStoreProduct[] {
  const newIds = new Set(newlyAdded.map((product) => product.id))
  return products
    .filter((product) => product.presence_status === 'visible')
    .sort((a, b) => {
      const priorityA = a.is_watched ? 0 : newIds.has(a.id) ? 1 : 2
      const priorityB = b.is_watched ? 0 : newIds.has(b.id) ? 1 : 2
      if (priorityA !== priorityB) return priorityA - priorityB
      return (a.detail_captured_at ?? '').localeCompare(b.detail_captured_at ?? '')
    })
}

function isDeferred(errorType: string | null): boolean {
  return errorType === 'PAGE_BUDGET_EXHAUSTED' || errorType === 'MARKETPLACE_COOLDOWN'
}

function isRisk(errorType: string | null): boolean {
  return ['CAPTCHA_DETECTED', 'HTTP_429', 'HTTP_503'].includes(errorType ?? '')
}

function defer(
  repo: SellerStoresRepository,
  store: SellerStore,
  errorType: string,
  message: string
): StoreScanResult {
  repo.updateJob(store.id, nextMorning(), errorType)
  return {
    success: false,
    deferred: true,
    scannedProducts: 0,
    deepProducts: 0,
    errorType,
    errorMessage: message
  }
}

function riskFailure(
  repo: SellerStoresRepository,
  budget: PageBudgetService,
  store: SellerStore,
  errorType: string,
  message: string
): StoreScanResult {
  budget.registerRisk(store.marketplace, errorType)
  repo.updateJob(store.id, nextMorning(), `cooldown:${errorType}`)
  return failure(repo, store, errorType, message)
}

function failure(
  repo: SellerStoresRepository,
  store: SellerStore,
  errorType: string,
  message: string
): StoreScanResult {
  repo.createSnapshot({
    store_id: store.id,
    public_rating: null,
    feedback_count: null,
    positive_30d: null,
    positive_90d: null,
    positive_365d: null,
    reported_product_count: null,
    scanned_product_count: 0,
    captured_at: new Date().toISOString(),
    capture_status: 'failed',
    error_type: errorType,
    error_message: message
  })
  repo.update(store.id, {
    consecutive_failures: store.consecutive_failures + 1,
    status: store.consecutive_failures + 1 >= 3 ? 'paused' : 'error'
  })
  return { success: false, scannedProducts: 0, deepProducts: 0, errorType, errorMessage: message }
}

function nextMorning(): string {
  const date = new Date()
  const next = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
    9,
    Math.floor(Math.random() * 16),
    0
  )
  return next
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, '')
}

function extractText(html: string, pattern: RegExp): string | null {
  return pattern.exec(html)?.[1]?.replace(/\s+/g, ' ').trim() ?? null
}
