// ============================================================
// Amazon URL / ASIN Parser
// Extracts ASIN and marketplace from user input.
// ============================================================

/**
 * Marketplace codes and their domains.
 * Order matters — longer domains (e.g. amazon.co.uk) must be
 * checked before shorter ones (amazon.com) to avoid partial matches.
 */
const MARKETPLACE_MAP: Array<{ domain: string; code: string }> = [
  { domain: 'amazon.co.uk', code: 'UK' },
  { domain: 'amazon.co.jp', code: 'JP' },
  { domain: 'amazon.com.au', code: 'AU' },
  { domain: 'amazon.com.br', code: 'BR' },
  { domain: 'amazon.com.mx', code: 'MX' },
  { domain: 'amazon.com', code: 'US' },
  { domain: 'amazon.de', code: 'DE' },
  { domain: 'amazon.fr', code: 'FR' },
  { domain: 'amazon.ca', code: 'CA' },
  { domain: 'amazon.it', code: 'IT' },
  { domain: 'amazon.es', code: 'ES' },
  { domain: 'amazon.in', code: 'IN' },
  { domain: 'amazon.ae', code: 'AE' },
  { domain: 'amzn.com', code: 'US' }
]

// ASIN: exactly 10 chars, starts with B, 9 alphanumeric digits/chars after
const ASIN_RE = /^B[A-Z0-9]{9}$/

// Extract ASIN from a URL path segment — /dp/ASIN or /product/ASIN
const DP_ASIN_RE = /\/dp\/(B[A-Z0-9]{9})(?:\/|\?|#|$)/i
const PRODUCT_ASIN_RE = /\/product\/(B[A-Z0-9]{9})(?:\/|\?|#|$)/i
const GP_PRODUCT_ASIN_RE = /\/gp\/product\/(B[A-Z0-9]{9})(?:\/|\?|#|$)/i

// Query string ASIN patterns like ?asin=XXX
const QUERY_ASIN_RE = /[?&]asin=(B[A-Z0-9]{9})(?:&|#|$)/i

export interface ParsedProduct {
  asin: string
  marketplace: string
  url: string
}

export interface ParseResult {
  success: true
  data: ParsedProduct
}

export interface ParseError {
  success: false
  error: string
}

export type ParseOutput = ParseResult | ParseError

/**
 * Parse user input — either an Amazon URL or a bare ASIN.
 */
export function parseAmazonInput(input: string): ParseOutput {
  const trimmed = input.trim()

  if (!trimmed) {
    return { success: false, error: 'Input is empty' }
  }

  // Detect if it looks like a URL
  if (isUrl(trimmed)) {
    return parseUrl(trimmed)
  }

  // Try bare ASIN
  return parseBareAsin(trimmed)
}

function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input) || input.includes('amazon.') || input.includes('amzn.')
}

function parseUrl(url: string): ParseOutput {
  // Normalize: ensure protocol
  let normalized = url
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized
  }

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    return { success: false, error: 'Invalid URL format' }
  }

  // Check it's an Amazon domain
  const marketplace = getMarketplace(parsed.hostname)
  if (!marketplace) {
    return {
      success: false,
      error: `Not an Amazon URL. Domain "${parsed.hostname}" is not a recognised Amazon marketplace.`
    }
  }

  // Try to extract ASIN from path
  const asin = extractAsin(parsed.pathname + parsed.search)
  if (!asin) {
    return {
      success: false,
      error:
        'Could not find an ASIN in this URL. ASIN looks like B0EXAMPLE1 (10 characters, starts with B). Make sure the URL includes /dp/ASIN, /gp/product/ASIN, or similar.'
    }
  }

  // Build clean canonical URL
  const canonicalUrl = `https://www.${getDomain(marketplace)}/dp/${asin}`

  return {
    success: true,
    data: { asin, marketplace, url: canonicalUrl }
  }
}

function parseBareAsin(input: string): ParseOutput {
  const upper = input.toUpperCase().trim()

  if (!ASIN_RE.test(upper)) {
    if (upper.length !== 10) {
      return {
        success: false,
        error: `ASIN must be exactly 10 characters. Got ${upper.length}. ASIN looks like B0EXAMPLE1.`
      }
    }
    if (!upper.startsWith('B')) {
      return {
        success: false,
        error: 'ASIN must start with "B". For example: B0EXAMPLE1.'
      }
    }
    return {
      success: false,
      error:
        'Invalid ASIN format. ASIN is 10 characters: starts with B, followed by 9 letters or numbers. For example: B0EXAMPLE1.'
    }
  }

  return {
    success: true,
    data: {
      asin: upper,
      marketplace: 'US', // default when bare ASIN
      url: `https://www.amazon.com/dp/${upper}`
    }
  }
}

function getMarketplace(hostname: string): string | null {
  const lower = hostname.toLowerCase().replace(/^www\./, '')

  for (const entry of MARKETPLACE_MAP) {
    if (lower === entry.domain || lower.endsWith('.' + entry.domain)) {
      return entry.code
    }
  }

  return null
}

function getDomain(marketplace: string): string {
  const entry = MARKETPLACE_MAP.find((e) => e.code === marketplace)
  return entry?.domain ?? 'amazon.com'
}

function extractAsin(pathAndQuery: string): string | null {
  // Priority order: /dp/ASIN, /gp/product/ASIN, /product/ASIN, query param
  let match = pathAndQuery.match(DP_ASIN_RE)
  if (match) return match[1].toUpperCase()

  match = pathAndQuery.match(GP_PRODUCT_ASIN_RE)
  if (match) return match[1].toUpperCase()

  match = pathAndQuery.match(PRODUCT_ASIN_RE)
  if (match) return match[1].toUpperCase()

  match = pathAndQuery.match(QUERY_ASIN_RE)
  if (match) return match[1].toUpperCase()

  return null
}
