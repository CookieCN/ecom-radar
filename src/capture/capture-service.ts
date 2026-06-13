// ============================================================
// Capture service — orchestrates URL parsing → browser → parser → snapshot
// ============================================================

import { parseAmazonInput } from './url-parser'
import { loadPage } from './browser'
import { parseProductPage } from './page-parser'
import type { NewSnapshot, CaptureErrorType } from '../data/types'
import type { ParsedProduct } from './url-parser'

export interface CaptureResult {
  success: true
  snapshot: NewSnapshot
  product: ParsedProduct
}

export interface CaptureFailure {
  success: false
  errorType: CaptureErrorType
  errorMessage: string
  product?: ParsedProduct // present if URL parsing succeeded (before page load/parse failed)
}

export type CaptureOutput = CaptureResult | CaptureFailure

const MIN_REQUIRED_FIELDS = 2 // need at least 2 of: title, price, rating, reviewCount

/**
 * Full capture pipeline for a user-input string (URL or ASIN).
 * 1. Parse input → asin + marketplace + canonical URL
 * 2. Load page in Playwright
 * 3. Parse page content
 * 4. Validate extracted fields
 *
 * Returns success: true ONLY when at least {MIN_REQUIRED_FIELDS} of the 4 key fields
 * (title, price, rating, reviewCount) were extracted.
 * Returns success: false for all other outcomes — URL parse failures, page load errors,
 * captcha/not-found/region-block, and insufficient parser output.
 */
export async function captureProduct(input: string): Promise<CaptureOutput> {
  // Step 1: Parse input
  const parsed = parseAmazonInput(input)
  if (!parsed.success) {
    return {
      success: false,
      errorType: 'PARSER_FAILED',
      errorMessage: parsed.error
      // no product — URL/ASIN was invalid
    }
  }

  const product = parsed.data

  // Step 2: Load the page
  const pageResult = await loadPage(product.url)
  if (!pageResult.success) {
    return {
      success: false,
      errorType: pageResult.errorType,
      errorMessage: pageResult.errorMessage,
      product
    }
  }

  // Step 3: Parse page content
  let pageData
  try {
    pageData = parseProductPage(pageResult.html, pageResult.finalUrl)
    console.log('[capture] parsed:', JSON.stringify({ url: product.url, title: pageData.title, price: pageData.price, rating: pageData.rating, reviews: pageData.reviewCount, availability: pageData.availability }))
  } catch (err) {
    return {
      success: false,
      errorType: 'PARSER_FAILED',
      errorMessage: `Failed to parse page content: ${err instanceof Error ? err.message : String(err)}`,
      product
    }
  }

  // Step 4: Count extracted fields
  const fieldsExtracted = [
    pageData.title,
    pageData.price,
    pageData.rating,
    pageData.reviewCount
  ].filter((v) => v != null).length

  // Build snapshot — always include whatever we got (even partial)
  const snapshot: NewSnapshot = {
    competitor_id: 0, // set by caller after competitor lookup/creation
    title: pageData.title,
    price: pageData.price,
    currency: pageData.currency,
    rating: pageData.rating,
    review_count: pageData.reviewCount,
    availability: pageData.availability,
    image_url: pageData.imageUrl,
    captured_at: new Date().toISOString(),
    capture_status: fieldsExtracted >= MIN_REQUIRED_FIELDS ? 'success' : 'failed',
    error_type: fieldsExtracted >= MIN_REQUIRED_FIELDS ? null : 'PARSER_FAILED',
    error_message:
      fieldsExtracted >= MIN_REQUIRED_FIELDS
        ? null
        : `Only extracted ${fieldsExtracted} of 4 key fields (title, price, rating, reviewCount)`
  }

  if (fieldsExtracted < MIN_REQUIRED_FIELDS) {
    return {
      success: false,
      errorType: 'PARSER_FAILED',
      errorMessage: snapshot.error_message!,
      product
    }
  }

  return {
    success: true,
    snapshot,
    product
  }
}
