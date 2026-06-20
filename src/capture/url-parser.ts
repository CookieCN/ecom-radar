// ============================================================
// Amazon URL / ASIN Parser
// Extracts ASIN and marketplace from user input.
// ============================================================

import {
  MARKETPLACE_CONFIGS,
  getMarketplaceByDomain,
  getMarketplaceConfig
} from '../shared/marketplaces'

const MARKETPLACE_CODES = new Set(MARKETPLACE_CONFIGS.map((entry) => entry.code))

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
export function parseAmazonInput(input: string, selectedMarketplace?: string): ParseOutput {
  const trimmed = input.trim()

  if (!trimmed) {
    return { success: false, error: 'Input is empty' }
  }

  if (selectedMarketplace && !MARKETPLACE_CODES.has(selectedMarketplace)) {
    return { success: false, error: `Unsupported Amazon marketplace: ${selectedMarketplace}` }
  }

  // Detect if it looks like a URL
  if (isUrl(trimmed)) {
    const parsed = parseUrl(trimmed)
    if (parsed.success && selectedMarketplace && parsed.data.marketplace !== selectedMarketplace) {
      return {
        success: false,
        error: `Selected marketplace is ${selectedMarketplace}, but this URL belongs to ${parsed.data.marketplace}. Choose ${parsed.data.marketplace} or paste a matching URL.`
      }
    }
    return parsed
  }

  // Try bare ASIN
  return parseBareAsin(trimmed, selectedMarketplace ?? 'US')
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

function parseBareAsin(input: string, marketplace: string): ParseOutput {
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
      marketplace,
      url: `https://www.${getDomain(marketplace)}/dp/${upper}`
    }
  }
}

function getMarketplace(hostname: string): string | null {
  if (/^(?:www\.)?amzn\.com$/i.test(hostname)) return 'US'
  return getMarketplaceByDomain(hostname)?.code ?? null
}

function getDomain(marketplace: string): string {
  return getMarketplaceConfig(marketplace)?.domain ?? 'amazon.com'
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
