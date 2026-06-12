// ============================================================
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
  rating: number | null
  reviewCount: number | null
  availability: string | null
  imageUrl: string | null
}

// JSON-LD Product schema shape we extract from
interface JsonLdProduct {
  '@type'?: string | string[]
  name?: string
  image?: string | string[]
  offers?: {
    '@type'?: string
    price?: string | number
    priceCurrency?: string
    availability?: string
  }
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
    return mergeWithFallback(jsonLd, html)
  }

  // Strategy 2: Meta tags
  const meta = extractFromMeta(html)

  // Strategy 3: DOM fallback
  const dom = extractFromDom(html)

  return mergeResults(meta, dom)
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
  if (lower.includes('sorry, we couldn\'t find that page')) return true
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
  return false
}

// ============================================================
// JSON-LD extraction
// ============================================================

function extractFromJsonLd(html: string): ParsedPageData | null {
  const scripts = extractJsonLdScripts(html)

  for (const json of scripts) {
    if (!json) continue

    try {
      const parsed = JSON.parse(json)
      const result = extractFromJsonLdObject(parsed)
      if (result && (result.title || result.price)) {
        return result
      }
    } catch {
      // Skip malformed JSON-LD
    }
  }

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
    const rawPrice = p.offers.price
    if (rawPrice !== undefined && rawPrice !== null) {
      price = typeof rawPrice === 'string' ? parseFloat(rawPrice) : rawPrice
      if (Number.isNaN(price)) price = null
    }
    currency = p.offers.priceCurrency || null
    availability = parseAvailability(p.offers.availability)
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
    title: p.name || null,
    price,
    currency,
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
    rating: parseMetaFloat(html, 'rating'),
    reviewCount: parseMetaInt(html, 'review-count'),
    availability: getMeta(html, 'availability'),
    imageUrl: getMeta(html, 'og:image')
  }
}

function getMeta(html: string, property: string): string | null {
  // Match property= or name= variants
  const re = new RegExp(
    `<meta\\s+[^>]*(?:property|name)=["']${escapeRe(property)}["'][^>]*>`,
    'i'
  )
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

function extractFromDom(html: string): ParsedPageData {
  return {
    title: extractDomText(html, '#productTitle'),
    price: extractDomPrice(html),
    currency: null, // DOM doesn't reliably give currency
    rating: extractDomRating(html),
    reviewCount: extractDomReviewCount(html),
    availability: extractDomAvailability(html),
    imageUrl: extractDomImage(html)
  }
}

function extractDomText(html: string, selector: string): string | null {
  // Simple regex-based extraction for known Amazon selectors
  if (selector === '#productTitle') {
    const m = html.match(/<span[^>]*id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)
    if (m) return cleanText(m[1])
  }
  return null
}

function extractDomPrice(html: string): number | null {
  // Try .a-price .a-offscreen pattern: contains "$24.99"
  const m = html.match(
    /<span[^>]*class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*\$?([\d,]+\.?\d*)\s*<\/span>/i
  )
  if (m) return parseFloat(m[1].replace(/,/g, ''))

  // Try #price_inside_buybox
  const m2 = html.match(/<span[^>]*id=["']price_inside_buybox["'][^>]*>[\s\S]*?\$?([\d,]+\.?\d*)/i)
  if (m2) return parseFloat(m2[1].replace(/,/g, ''))

  // Try .a-price-whole + .a-price-fraction
  const wholeM = html.match(
    /<span[^>]*class=["'][^"']*a-price-whole[^"']*["'][^>]*>\s*([\d,]+)\s*<\/span>/i
  )
  const fracM = html.match(
    /<span[^>]*class=["'][^"']*a-price-fraction[^"']*["'][^>]*>\s*(\d+)\s*<\/span>/i
  )
  if (wholeM) {
    const whole = parseFloat(wholeM[1].replace(/,/g, ''))
    const frac = fracM ? parseInt(fracM[1], 10) / 100 : 0
    return whole + frac
  }

  return null
}

function extractDomRating(html: string): number | null {
  // #acrPopover .a-icon-alt: "4.5 out of 5 stars"
  const m = html.match(/<span[^>]*class=["'][^"']*a-icon-alt[^"']*["'][^>]*>([\d.]+)\s*out\s*of/i)
  if (m) return parseFloat(m[1])

  // .a-icon-star .a-icon-alt
  const m2 = html.match(
    /<i[^>]*class=["'][^"']*a-icon-star[^"']*["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*a-icon-alt[^"']*["'][^>]*>([\d.]+)/i
  )
  if (m2) return parseFloat(m2[1])

  return null
}

function extractDomReviewCount(html: string): number | null {
  // #acrCustomerReviewText: "1,234 ratings"
  const m = html.match(
    /<span[^>]*id=["']acrCustomerReviewText["'][^>]*>\s*([\d,]+)\s+(?:ratings?|reviews?)/i
  )
  if (m) return parseInt(m[1].replace(/,/g, ''), 10)

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
  // #landingImage
  const m = html.match(/<img[^>]*id=["']landingImage["'][^>]*src=["']([^"']+)["']/i)
  if (m) return m[1]

  // #imgTagWrapperId img
  const m2 = html.match(
    /<div[^>]*id=["']imgTagWrapperId["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i
  )
  if (m2) return m2[1]

  return null
}

// ============================================================
// Helpers
// ============================================================

function mergeWithFallback(jsonLd: ParsedPageData, html: string): ParsedPageData {
  // JSON-LD is best, but fill gaps with DOM for fields that JSON-LD might miss
  const dom = extractFromDom(html)
  return {
    title: jsonLd.title || dom.title,
    price: jsonLd.price ?? dom.price,
    currency: jsonLd.currency ?? (jsonLd.price ? 'USD' : null),
    rating: jsonLd.rating ?? dom.rating,
    reviewCount: jsonLd.reviewCount ?? dom.reviewCount,
    availability: jsonLd.availability || dom.availability,
    imageUrl: jsonLd.imageUrl || dom.imageUrl
  }
}

function mergeResults(a: ParsedPageData, b: ParsedPageData): ParsedPageData {
  return {
    title: a.title || b.title,
    price: a.price ?? b.price,
    currency: a.currency ?? b.currency,
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
