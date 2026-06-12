import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseProductPage, detectCaptcha, detectProductNotFound, detectRegionBlock } from '../../src/capture/page-parser'

const fixturesDir = join(__dirname, '..', 'fixtures')

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8')
}

describe('parseProductPage — JSON-LD', () => {
  it('extracts all fields from standard JSON-LD', () => {
    const html = fixture('product-jsonld.html')
    const result = parseProductPage(html, 'https://www.amazon.com/dp/B0TEST')
    expect(result.title).toBe('Example Wireless Headphones Pro')
    expect(result.price).toBe(24.99)
    expect(result.currency).toBe('USD')
    expect(result.rating).toBe(4.5)
    expect(result.reviewCount).toBe(1234)
    expect(result.availability).toBe('In Stock')
    expect(result.imageUrl).toContain('41abc123')
  })

  it('extracts from @graph-wrapped JSON-LD', () => {
    const html = fixture('product-jsonld-graph.html')
    const result = parseProductPage(html, 'https://www.amazon.com/dp/B0TEST')
    expect(result.title).toBe('Graph Wireless Earbuds')
    expect(result.price).toBe(79.99)
    expect(result.rating).toBe(4.2)
    expect(result.reviewCount).toBe(567)
  })
})

describe('parseProductPage — Meta tags', () => {
  it('extracts from meta tags when JSON-LD absent', () => {
    const html = fixture('product-meta.html')
    const result = parseProductPage(html, 'https://www.amazon.com/dp/B0TEST')
    // Meta provides title, price, currency, image
    // DOM provides rating and reviewCount
    expect(result.title).toBeTruthy()
    expect(result.price).toBe(39.99)
    expect(result.currency).toBe('USD')
  })

  it('uses DOM fallback for fields missing from meta', () => {
    const html = fixture('product-meta.html')
    const result = parseProductPage(html, 'https://www.amazon.com/dp/B0TEST')
    expect(result.rating).toBe(4.0)
    expect(result.reviewCount).toBe(89)
  })
})

describe('parseProductPage — DOM fallback', () => {
  it('extracts all possible fields from DOM selectors', () => {
    const html = fixture('product-dom-only.html')
    const result = parseProductPage(html, 'https://www.amazon.com/dp/B0TEST')
    expect(result.title).toBe('DOM Only Speaker System')
    expect(result.price).toBe(149.99)
    expect(result.rating).toBe(4.7)
    expect(result.reviewCount).toBe(3210)
    expect(result.availability).toBe('In Stock')
    expect(result.imageUrl).toContain('61dom-only')
    expect(result.currency).toBeNull() // DOM cannot detect currency
  })
})

describe('parseProductPage — Out of stock', () => {
  it('detects out of stock availability', () => {
    const html = fixture('product-out-of-stock.html')
    const result = parseProductPage(html, 'https://www.amazon.com/dp/B0TEST')
    expect(result.title).toBe('Sold Out Gadget')
    expect(result.price).toBe(299.99)
    expect(result.availability).toBe('Out of Stock')
    expect(result.rating).toBe(3.8)
  })
})

describe('parseProductPage — Minimal / empty page', () => {
  it('returns null fields for a page with no product data', () => {
    const html = fixture('product-minimal.html')
    const result = parseProductPage(html, 'https://www.amazon.com/dp/B0TEST')
    expect(result.title).toBeNull()
    expect(result.price).toBeNull()
    expect(result.rating).toBeNull()
    expect(result.reviewCount).toBeNull()
  })
})

// ============================================================
// Captcha detection
// ============================================================

describe('detectCaptcha', () => {
  it('detects classic captcha page', () => {
    const html = fixture('captcha.html')
    expect(detectCaptcha(html, 'https://www.amazon.com/dp/B0TEST')).toBe(true)
  })

  it('detects URL-based captcha', () => {
    expect(detectCaptcha('<html></html>', 'https://www.amazon.com/errors/validateCaptcha')).toBe(true)
    expect(detectCaptcha('<html></html>', 'https://www.amazon.com/captcha/verify')).toBe(true)
  })

  it('detects robot check message', () => {
    const html = '<html><body>To discuss automated access to Amazon data please contact us</body></html>'
    expect(detectCaptcha(html, 'https://www.amazon.com/dp/B0TEST')).toBe(true)
  })

  it('returns false for normal product page', () => {
    const html = fixture('product-jsonld.html')
    expect(detectCaptcha(html, 'https://www.amazon.com/dp/B0TEST')).toBe(false)
  })
})

// ============================================================
// Product not found detection
// ============================================================

describe('detectProductNotFound', () => {
  it('detects dog page', () => {
    const html = fixture('product-not-found.html')
    expect(detectProductNotFound(html)).toBe(true)
  })

  it('returns false for normal product page', () => {
    const html = fixture('product-jsonld.html')
    expect(detectProductNotFound(html)).toBe(false)
  })
})

// ============================================================
// Region block detection
// ============================================================

describe('detectRegionBlock', () => {
  it('detects region block message', () => {
    const html = '<html><body>This item cannot be shipped to your selected delivery location.</body></html>'
    expect(detectRegionBlock(html)).toBe(true)
  })

  it('detects not available in country', () => {
    const html = '<html><body>Not available in your country.</body></html>'
    expect(detectRegionBlock(html)).toBe(true)
  })

  it('returns false for normal page', () => {
    const html = fixture('product-jsonld.html')
    expect(detectRegionBlock(html)).toBe(false)
  })
})

// ============================================================
// Integration: JSON-LD preferred over DOM
// ============================================================

describe('parseProductPage — priority', () => {
  it('prefers JSON-LD title over DOM', () => {
    const html = fixture('product-jsonld.html')
    const result = parseProductPage(html, 'https://www.amazon.com/dp/B0TEST')
    expect(result.title).toBe('Example Wireless Headphones Pro')
  })

  it('fills missing JSON-LD fields from DOM', () => {
    const html = fixture('product-jsonld.html')
    const result = parseProductPage(html, 'https://www.amazon.com/dp/B0TEST')
    // JSON-LD has most fields, but we still get DOM-complemented data
    expect(result.rating).toBe(4.5)
    expect(result.reviewCount).toBe(1234)
    expect(result.availability).toBe('In Stock')
  })
})
