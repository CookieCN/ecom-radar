// ============================================================

import { getMarketplaceByDomain } from '../shared/marketplaces'
// Amazon product page parser
// Extracts product data from HTML using:
//   1. JSON-LD structured data
//   2. Meta tags
//   3. DOM selectors (fallback)
// ============================================================

export interface ParsedPageData {
  title: string | null
  price: number | null
  currency: string | null
  priceType: string | null
  regularPrice: number | null
  listPrice: number | null
  rating: number | null
  reviewCount: number | null
  availability: string | null
  imageUrl: string | null
}

// JSON-LD Product schema shape we extract from
interface JsonLdOffer {
  '@type'?: string
  price?: string | number
  priceCurrency?: string
  availability?: string
}

interface JsonLdProduct {
  '@type'?: string | string[]
  name?: string
  image?: string | string[]
  offers?: JsonLdOffer | JsonLdOffer[]
  aggregateRating?: {
    '@type'?: string
    ratingValue?: string | number
    reviewCount?: string | number
    ratingCount?: string | number
  }
}

interface JsonLdGraph {
  '@graph'?: JsonLdProduct[]
}

/**
 * Parse an Amazon product page HTML string.
 * Returns null fields for anything that couldn't be extracted.
 */
export function parseProductPage(html: string, _url: string): ParsedPageData {
  // Strategy 1: JSON-LD (most reliable)
  const jsonLd = extractFromJsonLd(html)
  if (jsonLd) {
    return withCurrencyFallback(mergeWithFallback(jsonLd, html, _url), _url)
  }

  // Strategy 2: Meta tags
  const meta = extractFromMeta(html)

  // Strategy 3: DOM fallback
  const dom = extractFromDom(html, _url)

  return withCurrencyFallback(mergeResults(meta, dom), _url)
}

/**
 * Detect whether the current page is an Amazon captcha / robot check page.
 */
export function detectCaptcha(html: string, url: string): boolean {
  const lower = html.toLowerCase()

  // Classic Amazon captcha
  if (lower.includes('enter the characters you see below')) return true
  if (lower.includes('type the characters you see')) return true

  // Modern robot check
  if (lower.includes("sorry, we just need to make sure you're not a robot")) return true
  if (lower.includes('to discuss automated access to amazon data')) return true

  // CAPTCHA form
  if (/<img[^>]*captcha/i.test(html)) return true
  if (/name=["']?field-keywords["']?[^>]*placeholder=["']?\s*type\s+characters/i.test(html))
    return true

  // URL-based
  if (/\/captcha\//i.test(url)) return true
  if (/\/errors\/validateCaptcha/i.test(url)) return true

  return false
}

/**
 * Detect if the page indicates the product was not found.
 */
export function detectProductNotFound(html: string): boolean {
  const lower = html.toLowerCase()
  // Dog page — Amazon shows dogs when product not found
  if (lower.includes("sorry, we couldn't find that page")) return true
  if (lower.includes('page not found') && lower.includes('dog')) return true
  if (lower.includes('looking for something?')) return true
  return false
}

/**
 * Detect if the page is a region-block / unavailable page.
 */
export function detectRegionBlock(html: string): boolean {
  const lower = html.toLowerCase()
  if (lower.includes('not available in your country')) return true
  if (lower.includes('this item cannot be shipped to your selected')) return true
  if (lower.includes('this item cannot be dispatched to your selected')) return true
  if (lower.includes('kann nicht an den ausgewählten lieferort versendet werden')) return true
  if (lower.includes('kann nicht an ihre ausgewählte lieferadresse versendet werden')) return true
  return false
}

// ============================================================
// JSON-LD extraction
// ============================================================

function extractFromJsonLd(html: string): ParsedPageData | null {
  const scripts = extractJsonLdScripts(html)

  if (scripts.length === 0) {
    console.log('[parser] no JSON-LD scripts found')
    return null
  }

  for (const json of scripts) {
    if (!json) continue

    try {
      const parsed = JSON.parse(json)
      const result = extractFromJsonLdObject(parsed)
      if (result && (result.title || result.price)) {
        console.log(
          '[parser] JSON-LD extracted:',
          JSON.stringify({ title: result.title, price: result.price, rating: result.rating })
        )
        return result
      }
    } catch {
      // Skip malformed JSON-LD
    }
  }

  console.log('[parser] JSON-LD found but no Product data extracted')
  return null
}

function extractJsonLdScripts(html: string): string[] {
  const results: string[] = []
  // Match <script type="application/ld+json">...</script>
  const re = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    results.push(match[1].trim())
  }
  return results
}

function extractFromJsonLdObject(obj: unknown): ParsedPageData | null {
  if (!obj || typeof obj !== 'object') return null

  // Some pages wrap in @graph
  const graph = obj as JsonLdGraph
  if (graph['@graph'] && Array.isArray(graph['@graph'])) {
    for (const item of graph['@graph']) {
      const r = extractFromJsonLdObject(item)
      if (r) return r
    }
    return null
  }

  const p = obj as JsonLdProduct

  // Check if this is a Product type
  const types = normalizeType(p['@type'])
  if (!types.includes('Product')) return null

  let price: number | null = null
  let currency: string | null = null
  let availability: string | null = null

  if (p.offers) {
    // Amazon sometimes wraps offers in an array (multiple sellers)
    const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers
    if (offer && typeof offer === 'object') {
      const rawPrice = (offer as Record<string, unknown>).price
      if (rawPrice !== undefined && rawPrice !== null) {
        price = typeof rawPrice === 'string' ? parseFloat(rawPrice) : (rawPrice as number)
        if (Number.isNaN(price)) price = null
      }
      currency = ((offer as Record<string, unknown>).priceCurrency as string) || null
      availability = parseAvailability((offer as Record<string, unknown>).availability as string)
    }
  }

  let rating: number | null = null
  let reviewCount: number | null = null

  if (p.aggregateRating) {
    const rawRating = p.aggregateRating.ratingValue
    if (rawRating !== undefined && rawRating !== null) {
      rating = typeof rawRating === 'string' ? parseFloat(rawRating) : rawRating
      if (Number.isNaN(rating)) rating = null
    }

    // reviewCount or ratingCount
    const rawCount = p.aggregateRating.reviewCount ?? p.aggregateRating.ratingCount
    if (rawCount !== undefined && rawCount !== null) {
      reviewCount = typeof rawCount === 'string' ? parseInt(rawCount, 10) : rawCount
      if (Number.isNaN(reviewCount)) reviewCount = null
    }
  }

  // Normalize image to single string
  let imageUrl: string | null = null
  if (typeof p.image === 'string') {
    imageUrl = p.image
  } else if (Array.isArray(p.image) && p.image.length > 0) {
    imageUrl = typeof p.image[0] === 'string' ? p.image[0] : null
  }

  return {
    title: p.name ? cleanText(p.name) : null,
    price,
    currency,
    priceType: price !== null ? 'STANDARD' : null,
    regularPrice: null,
    listPrice: null,
    rating,
    reviewCount,
    availability,
    imageUrl
  }
}

function normalizeType(t: string | string[] | undefined): string[] {
  if (!t) return []
  if (typeof t === 'string') return [t]
  return t
}

function parseAvailability(raw: string | undefined): string | null {
  if (!raw) return null
  const r = raw.toLowerCase()
  if (r.includes('instock') || r.includes('in_stock')) return 'In Stock'
  if (r.includes('outofstock') || r.includes('out_of_stock')) return 'Out of Stock'
  if (r.includes('preorder') || r.includes('pre_order')) return 'Pre-order'
  return raw
}

// ============================================================
// Meta tag extraction
// ============================================================

function extractFromMeta(html: string): ParsedPageData {
  return {
    title: getMeta(html, 'og:title'),
    price: parseMetaFloat(html, 'product:price:amount'),
    currency: getMeta(html, 'product:price:currency'),
    priceType: null,
    regularPrice: null,
    listPrice: null,
    rating: parseMetaFloat(html, 'rating'),
    reviewCount: parseMetaInt(html, 'review-count'),
    availability: getMeta(html, 'availability'),
    imageUrl: getMeta(html, 'og:image')
  }
}

function getMeta(html: string, property: string): string | null {
  // Match property= or name= variants
  const re = new RegExp(`<meta\\s+[^>]*(?:property|name)=["']${escapeRe(property)}["'][^>]*>`, 'i')
  const match = html.match(re)
  if (!match) return null

  const contentMatch = match[0].match(/content=["']([^"']*)["']/i)
  return contentMatch ? contentMatch[1] || null : null
}

function parseMetaFloat(html: string, property: string): number | null {
  const v = getMeta(html, property)
  if (!v) return null
  const n = parseFloat(v)
  return Number.isNaN(n) ? null : n
}

function parseMetaInt(html: string, property: string): number | null {
  const v = getMeta(html, property)
  if (!v) return null
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? null : n
}

// ============================================================
// DOM fallback
// ============================================================

function extractFromDom(html: string, _url: string): ParsedPageData {
  const priceContext = extractDomPriceContext(html)
  return {
    title: extractDomTitle(html),
    price: priceContext.price,
    currency: extractDomCurrency(html),
    priceType: priceContext.priceType,
    regularPrice: priceContext.regularPrice,
    listPrice: priceContext.listPrice,
    rating: extractDomRating(html),
    reviewCount: extractDomReviewCount(html),
    availability: extractDomAvailability(html),
    imageUrl: extractDomImage(html)
  }
}

function extractDomCurrency(html: string): string | null {
  const scopes = [
    'corePrice_feature_div',
    'corePriceDisplay_desktop_feature_div',
    'apex_desktop',
    'buybox'
  ]
    .map((id) => extractElementWindow(html, id))
    .filter((scope): scope is string => scope !== null)
    .join('\n')

  const visiblePriceTexts = Array.from(
    scopes.matchAll(
      /class=["'][^"']*(?:a-offscreen|a-price-symbol)[^"']*["'][^>]*>([^<]+)<\/[^>]+>/gi
    ),
    (match) => cleanText(match[1])
  )
  for (const text of visiblePriceTexts) {
    const code = text.match(/(?:USD|CAD|MXN|BRL|GBP|EUR|JPY|INR|AUD|AED)/i)?.[0]
    if (code) return code.toUpperCase()
    if (text.includes('€')) return 'EUR'
    if (text.includes('£')) return 'GBP'
    if (/[¥￥]/.test(text)) return 'JPY'
  }
  return null
}

interface DomPriceContext {
  price: number | null
  priceType: string | null
  regularPrice: number | null
  listPrice: number | null
}

function extractDomPriceContext(html: string): DomPriceContext {
  const price = extractDomPrice(html)
  const scopes = [
    'corePrice_feature_div',
    'corePriceDisplay_desktop_feature_div',
    'apex_desktop',
    'buybox'
  ]
    .map((id) => extractElementWindow(html, id))
    .filter((scope): scope is string => scope !== null)
  const combined = scopes.join('\n')
  const lower = cleanText(combined).toLowerCase()

  const regularPrice = extractLabeledPrice(combined, [
    'non-deal price',
    'regular price',
    'standard price',
    'preis ohne angebot'
  ])
  const listPrice =
    extractTextPrice(
      combined,
      /<span[^>]*class=["'][^"']*a-text-price[^"']*["'][^>]*>[\s\S]{0,500}?<span[^>]*class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)<\/span>/i
    ) ?? extractLabeledPrice(combined, ['rrp', 'list price', 'uvp'])

  let priceType: string | null = price !== null ? 'STANDARD' : null
  if (price !== null && lower.includes('deal')) {
    priceType = lower.includes('prime') ? 'PRIME_DEAL' : 'DEAL'
  }

  return { price, priceType, regularPrice, listPrice }
}

function extractLabeledPrice(html: string, labels: string[]): number | null {
  const lower = html.toLowerCase()
  for (const label of labels) {
    const index = lower.indexOf(label)
    if (index < 0) continue
    const nearby = html.slice(index, index + 800)
    const price = extractTextPrice(
      nearby,
      /<span[^>]*class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)<\/span>/i
    )
    if (price !== null) return price
  }
  return null
}

function extractTextPrice(html: string, pattern: RegExp): number | null {
  const match = html.match(pattern)
  return match ? parseLocalizedPrice(match[1]) : null
}

function extractDomPrice(html: string): number | null {
  // Priority 1: apex-pricetopay-value — Amazon's main price badge (most reliable)
  const apexMatch = html.match(
    /apex-pricetopay-value[^>]*>[\s\S]*?a-offscreen[^>]*>\s*\$?([\d,]+\.?\d*)/i
  )
  if (apexMatch) {
    const price = parseLocalizedPrice(apexMatch[1])
    console.log('[parser] apex price found:', price)
    return price
  }
  console.log('[parser] apex-pricetopay-value NOT found in page')

  // Priority 2: #price_inside_buybox
  const m2 = html.match(/id=["']price_inside_buybox["'][^>]*>[\s\S]*?\$?([\d,]+\.?\d*)/i)
  if (m2) {
    console.log('[parser] buybox price found:', m2[1])
    return parseLocalizedPrice(m2[1])
  }

  // Remaining selectors are only trustworthy inside Amazon's main price/buy-box features.
  const priceScopes = [
    'corePrice_feature_div',
    'corePriceDisplay_desktop_feature_div',
    'apex_desktop',
    'buybox'
  ]
    .map((id) => extractElementWindow(html, id))
    .filter((scope): scope is string => scope !== null)

  for (const scope of priceScopes) {
    const offscreen = extractCurrentOffscreenPrice(scope)
    if (offscreen !== null) {
      console.log('[parser] scoped offscreen price found:', offscreen)
      return offscreen
    }

    const wholeM = scope.match(
      /<span[^>]*class=["'][^"']*a-price-whole[^"']*["'][^>]*>\s*([\d.,]+)\s*<\/span>/i
    )
    const fracM = scope.match(
      /<span[^>]*class=["'][^"']*a-price-fraction[^"']*["'][^>]*>\s*(\d+)\s*<\/span>/i
    )
    if (wholeM) {
      const whole = parseLocalizedPrice(wholeM[1])
      if (whole !== null) {
        const frac = fracM ? parseInt(fracM[1], 10) / 100 : 0
        console.log('[parser] scoped whole+fraction price found:', whole + frac)
        return whole + frac
      }
    }
  }

  console.log('[parser] NO price found on page')
  return null
}

function extractElementWindow(html: string, id: string): string | null {
  const match = new RegExp(`<([a-z][\\w:-]*)\\b[^>]*\\bid=["']${escapeRe(id)}["'][^>]*>`, 'i').exec(
    html
  )
  if (!match || match.index === undefined) return null

  const tagName = match[1]
  const tagPattern = new RegExp(`<\\/?${escapeRe(tagName)}\\b[^>]*>`, 'gi')
  tagPattern.lastIndex = match.index
  let depth = 0
  let tagMatch: RegExpExecArray | null

  while ((tagMatch = tagPattern.exec(html)) !== null) {
    const tag = tagMatch[0]
    if (tag.startsWith('</')) {
      depth -= 1
      if (depth === 0) return html.slice(match.index, tagPattern.lastIndex)
    } else if (!tag.endsWith('/>')) {
      depth += 1
    }
  }

  return null
}

function extractCurrentOffscreenPrice(scope: string): number | null {
  const pricePattern =
    /<span[^>]*class=["'][^"']*a-price(?!-)[^"']*["'][^>]*>[\s\S]{0,600}?<span[^>]*class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)<\/span>/gi

  for (const match of scope.matchAll(pricePattern)) {
    const outerTag = match[0].slice(0, match[0].indexOf('>') + 1)
    if (/a-text-price/i.test(outerTag)) continue
    const price = parseLocalizedPrice(match[1])
    if (price !== null) return price
  }

  return null
}

function parseLocalizedPrice(raw: string): number | null {
  let value = cleanText(raw).replace(/[^\d.,]/g, '')
  if (!value) return null

  const lastComma = value.lastIndexOf(',')
  const lastDot = value.lastIndexOf('.')

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.'
    const groupingSeparator = decimalSeparator === ',' ? /\./g : /,/g
    value = value.replace(groupingSeparator, '').replace(decimalSeparator, '.')
  } else {
    const separator = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : null
    if (separator) {
      const separatorIndex = value.lastIndexOf(separator)
      const decimalDigits = value.length - separatorIndex - 1
      value =
        decimalDigits === 2
          ? `${value.slice(0, separatorIndex).replace(/[.,]/g, '')}.${value.slice(separatorIndex + 1)}`
          : value.replace(/[.,]/g, '')
    }
  }

  const price = Number(value)
  return Number.isFinite(price) ? price : null
}

function inferCurrencyFromUrl(url: string): string | null {
  try {
    return getMarketplaceByDomain(new URL(url).hostname)?.currency ?? null
  } catch {
    return null
  }
}

function withCurrencyFallback(data: ParsedPageData, url: string): ParsedPageData {
  return { ...data, currency: data.currency ?? inferCurrencyFromUrl(url) }
}

function extractDomTitle(html: string): string | null {
  const m = html.match(/<span[^>]*id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)
  if (m) {
    const title = cleanText(m[1])
    console.log('[parser] title found:', title.slice(0, 80))
    return title
  }
  console.log('[parser] #productTitle NOT found')
  return null
}

function extractDomRating(html: string): number | null {
  // Localized examples: "4.5 out of 5 stars", "4,6 von 5 Sternen".
  const m = html.match(
    /<span[^>]*class=["'][^"']*a-icon-alt[^"']*["'][^>]*>\s*([\d.,]+)\s*(?:out\s*of|von|sur|su|de)\s*5/i
  )
  if (m) return parseLocalizedDecimal(m[1])

  // .a-icon-star .a-icon-alt
  const m2 = html.match(
    /<i[^>]*class=["'][^"']*a-icon-star[^"']*["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*a-icon-alt[^"']*["'][^>]*>([\d.]+)/i
  )
  if (m2) return parseLocalizedDecimal(m2[1])

  return null
}

function parseLocalizedDecimal(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

function extractDomReviewCount(html: string): number | null {
  // #acrCustomerReviewText: "1,234 ratings"
  const m = html.match(
    /<span[^>]*id=["']acrCustomerReviewText["'][^>]*>\s*\(?\s*([\d.,\s]+)\s*\)?/i
  )
  if (m) return parseInt(m[1].replace(/\D/g, ''), 10)

  // Alternate: data-hook="total-review-count"
  const m2 = html.match(
    /<span[^>]*data-hook=["']total-review-count["'][^>]*>\s*([\d,]+)\s*<\/span>/i
  )
  if (m2) return parseInt(m2[1].replace(/,/g, ''), 10)

  return null
}

function extractDomAvailability(html: string): string | null {
  // #availability span
  const m = html.match(
    /<div[^>]*id=["']availability["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i
  )
  if (m) return cleanText(m[1])

  return null
}

function extractDomImage(html: string): string | null {
  const landingImage = html.match(/<img\b[^>]*\bid=["']landingImage["'][^>]*>/i)?.[0]
  if (landingImage) {
    const highResolution = getHtmlAttribute(landingImage, 'data-old-hires')
    if (highResolution) return highResolution

    const dynamicImages = getHtmlAttribute(landingImage, 'data-a-dynamic-image')
    if (dynamicImages) {
      try {
        const urls = Object.keys(JSON.parse(cleanText(dynamicImages)) as Record<string, unknown>)
        if (urls.length > 0) return urls[0]
      } catch {
        // Fall through to src when Amazon returns malformed dynamic-image data.
      }
    }

    const src = getHtmlAttribute(landingImage, 'src')
    if (src) return src
  }

  // #imgTagWrapperId img
  const m2 = html.match(
    /<div[^>]*id=["']imgTagWrapperId["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i
  )
  if (m2) return m2[1]

  return null
}

function getHtmlAttribute(tag: string, attribute: string): string | null {
  const match = tag.match(new RegExp(`\\b${escapeRe(attribute)}=["']([^"']*)["']`, 'i'))
  return match?.[1] || null
}

// ============================================================
// Helpers
// ============================================================

function mergeWithFallback(jsonLd: ParsedPageData, html: string, url: string): ParsedPageData {
  // JSON-LD is best, but fill gaps with DOM for fields that JSON-LD might miss
  const dom = extractFromDom(html, url)
  return {
    title: jsonLd.title || dom.title,
    price: dom.price ?? jsonLd.price,
    currency: dom.currency ?? jsonLd.currency,
    priceType: dom.priceType ?? jsonLd.priceType,
    regularPrice: dom.regularPrice ?? jsonLd.regularPrice,
    listPrice: dom.listPrice ?? jsonLd.listPrice,
    rating: jsonLd.rating ?? dom.rating,
    reviewCount: jsonLd.reviewCount ?? dom.reviewCount,
    availability: jsonLd.availability || dom.availability,
    imageUrl: jsonLd.imageUrl || dom.imageUrl
  }
}

function mergeResults(a: ParsedPageData, b: ParsedPageData): ParsedPageData {
  return {
    title: a.title || b.title,
    price: b.price ?? a.price,
    currency: b.currency ?? a.currency,
    priceType: b.priceType ?? a.priceType,
    regularPrice: b.regularPrice ?? a.regularPrice,
    listPrice: b.listPrice ?? a.listPrice,
    rating: a.rating ?? b.rating,
    reviewCount: a.reviewCount ?? b.reviewCount,
    availability: a.availability || b.availability,
    imageUrl: a.imageUrl || b.imageUrl
  }
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '') // strip any remaining tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
