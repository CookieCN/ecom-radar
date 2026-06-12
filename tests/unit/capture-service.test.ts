import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the browser module before importing the service under test
vi.mock('../../src/capture/browser', () => ({
  loadPage: vi.fn(),
  getBrowser: vi.fn(),
  closeBrowser: vi.fn()
}))

import { loadPage } from '../../src/capture/browser'
import { captureProduct } from '../../src/capture/capture-service'

const mockLoadPage = loadPage as ReturnType<typeof vi.fn>
function mockPageSuccess(overrides: Partial<{ html: string }> = {}): void {
  mockLoadPage.mockResolvedValue({
    success: true,
    html: overrides.html ?? fixtureProductJsonLd(),
    finalUrl: 'https://www.amazon.com/dp/B0EXAMPLE1'
  })
}

function mockPageError(
  errorType: string,
  errorMessage: string
): void {
  mockLoadPage.mockResolvedValue({
    success: false,
    errorType,
    errorMessage
  })
}

// Minimal JSON-LD product fixture
function fixtureProductJsonLd(): string {
  return `<!DOCTYPE html><html><head>
<script type="application/ld+json">
{"@type":"Product","name":"Test Headphones","image":"https://img.example.com/abc.jpg","offers":{"@type":"Offer","price":"49.99","priceCurrency":"USD","availability":"https://schema.org/InStock"},"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.3","reviewCount":"256"}}
</script></head><body></body></html>`
}

function fixturePartialProduct(): string {
  return `<!DOCTYPE html><html><head>
<script type="application/ld+json">
{"@type":"Product","name":"Partial Product"}
</script></head><body></body></html>`
}

describe('captureProduct — success paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns success with full product data from JSON-LD', async () => {
    mockPageSuccess()
    const result = await captureProduct('B0EXAMPLE1')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.product.asin).toBe('B0EXAMPLE1')
      expect(result.snapshot.title).toBe('Test Headphones')
      expect(result.snapshot.price).toBe(49.99)
      expect(result.snapshot.currency).toBe('USD')
      expect(result.snapshot.rating).toBe(4.3)
      expect(result.snapshot.review_count).toBe(256)
      expect(result.snapshot.capture_status).toBe('success')
    }
  })

  it('returns success with canonical URL from bare ASIN', async () => {
    mockPageSuccess()
    const result = await captureProduct('B0EXAMPLE1')
    if (result.success) {
      expect(result.product.url).toBe('https://www.amazon.com/dp/B0EXAMPLE1')
    }
  })

  it('returns success from a full Amazon URL', async () => {
    mockPageSuccess()
    const result = await captureProduct('https://www.amazon.co.uk/dp/B0EXAMPLE1')
    if (result.success) {
      expect(result.product.marketplace).toBe('UK')
    }
  })
})

describe('captureProduct — failure paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns failure for invalid URL (no product)', async () => {
    const result = await captureProduct('')
    expect(result.success).toBe(false)
    expect(result.product).toBeUndefined()
    if (!result.success) {
      expect(result.errorType).toBe('PARSER_FAILED')
    }
  })

  it('returns failure for non-Amazon URL (no product)', async () => {
    const result = await captureProduct('https://www.ebay.com/item/123')
    expect(result.success).toBe(false)
    expect(result.product).toBeUndefined()
  })

  it('returns failure with product for captcha page', async () => {
    mockPageError('CAPTCHA_DETECTED', 'Captcha detected')
    const result = await captureProduct('B0EXAMPLE1')
    expect(result.success).toBe(false)
    expect(result.product).toBeDefined()
    if (!result.success) {
      expect(result.product!.asin).toBe('B0EXAMPLE1')
      expect(result.errorType).toBe('CAPTCHA_DETECTED')
    }
  })

  it('returns failure with product for page timeout', async () => {
    mockPageError('NETWORK_TIMEOUT', 'Page load timed out after 30s')
    const result = await captureProduct('https://www.amazon.com/dp/B0EXAMPLE1')
    expect(result.success).toBe(false)
    expect(result.product).toBeDefined()
    if (!result.success) {
      expect(result.errorType).toBe('NETWORK_TIMEOUT')
    }
  })

  it('returns failure with product for product not found', async () => {
    mockPageError('PRODUCT_NOT_FOUND', 'Product page not found')
    const result = await captureProduct('B0EXAMPLE1')
    expect(result.success).toBe(false)
    expect(result.product).toBeDefined()
    if (!result.success) {
      expect(result.errorType).toBe('PRODUCT_NOT_FOUND')
    }
  })

  it('returns failure with product for region block', async () => {
    mockPageError('REGION_BLOCKED', 'Region blocked')
    const result = await captureProduct('B0EXAMPLE1')
    expect(result.success).toBe(false)
    expect(result.product).toBeDefined()
    if (!result.success) {
      expect(result.errorType).toBe('REGION_BLOCKED')
    }
  })

  it('returns failure with product when parser extracts insufficient fields', async () => {
    mockPageSuccess({ html: fixturePartialProduct() })
    const result = await captureProduct('B0EXAMPLE1')
    expect(result.success).toBe(false)
    expect(result.product).toBeDefined()
    if (!result.success) {
      expect(result.errorType).toBe('PARSER_FAILED')
      expect(result.errorMessage).toContain('Only extracted')
    }
  })
})

describe('captureProduct — snapshot metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets capture_status to success when >= 2 fields extracted', async () => {
    mockPageSuccess()
    const result = await captureProduct('B0EXAMPLE1')
    if (result.success) {
      expect(result.snapshot.capture_status).toBe('success')
      expect(result.snapshot.error_type).toBeNull()
      expect(result.snapshot.error_message).toBeNull()
    }
  })

  it('sets captured_at to ISO timestamp', async () => {
    mockPageSuccess()
    const result = await captureProduct('B0EXAMPLE1')
    if (result.success) {
      expect(result.snapshot.captured_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      )
    }
  })
})
