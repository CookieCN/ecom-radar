import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  parseProductPage,
  detectCaptcha,
  detectProductNotFound,
  detectRegionBlock
} from '../../src/capture/page-parser'

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
    expect(result.currency).toBe('USD')
  })

  it('parses a German decimal-comma price only from the main price feature', () => {
    const html = `
      <div id="unrelated-recommendation"><span class="a-price"><span class="a-offscreen">16,60 €</span></span></div>
      <div id="corePrice_feature_div"><span class="a-price"><span class="a-offscreen">99,99 €</span></span></div>
    `
    const result = parseProductPage(html, 'https://www.amazon.de/dp/B0DCBB2YTR')
    expect(result.price).toBe(99.99)
    expect(result.currency).toBe('EUR')
  })

  it('prefers the displayed Prime deal and keeps regular and list prices', () => {
    const html = `
      <script type="application/ld+json">
        {"@type":"Product","name":"Deal Product","offers":{"price":"89.99","priceCurrency":"EUR"}}
      </script>
      <div id="corePrice_feature_div">
        <span>Early Prime Day Deal</span>
        <span class="a-price"><span class="a-offscreen">79,98 €</span></span>
        <span class="a-text-price"><span class="a-offscreen">99,99 €</span></span>
      </div>
      <div id="buybox">
        <span>Non-Deal Price</span>
        <span class="a-price"><span class="a-offscreen">89,99 €</span></span>
      </div>
    `
    const result = parseProductPage(html, 'https://www.amazon.de/dp/B0DCBB2YTR')
    expect(result.price).toBe(79.98)
    expect(result.priceType).toBe('PRIME_DEAL')
    expect(result.regularPrice).toBe(89.99)
    expect(result.listPrice).toBe(99.99)
    expect(result.currency).toBe('EUR')
  })

  it('reports the currency actually rendered in the primary price region', () => {
    const html = `
      <div id="corePrice_feature_div">
        <span class="a-price apex-pricetopay-value"><span class="a-offscreen">14.767JPY</span></span>
      </div>
    `
    const result = parseProductPage(html, 'https://www.amazon.de/dp/B0DCBB2YTR')
    expect(result.price).toBe(14767)
    expect(result.currency).toBe('JPY')
  })

  it('parses localized German rating and parenthesized review count', () => {
    const html = `
      <span class="a-icon-alt">4,6 von 5 Sternen</span>
      <span id="acrCustomerReviewText" aria-label="9.841 Rezensionen">(9.841)</span>
    `
    const result = parseProductPage(html, 'https://www.amazon.de/dp/B0DCBB2YTR')
    expect(result.rating).toBe(4.6)
    expect(result.reviewCount).toBe(9841)
  })

  it('does not use a price outside the main price or buy-box features', () => {
    const html = `
      <div id="corePrice_feature_div"></div>
      <div id="unrelated-recommendation"><span class="a-price"><span class="a-offscreen">16,60 €</span></span></div>
    `
    expect(parseProductPage(html, 'https://www.amazon.de/dp/B0DCBB2YTR').price).toBeNull()
  })

  it('extracts a landing image when src appears before id', () => {
    const html = '<img src="https://m.media-amazon.com/images/I/src-first.jpg" id="landingImage">'
    expect(parseProductPage(html, 'https://www.amazon.com/dp/B0TEST').imageUrl).toBe(
      'https://m.media-amazon.com/images/I/src-first.jpg'
    )
  })

  it('prefers the high-resolution landing image', () => {
    const html =
      '<img id="landingImage" src="https://m.media-amazon.com/low.jpg" data-old-hires="https://m.media-amazon.com/high.jpg">'
    expect(parseProductPage(html, 'https://www.amazon.com/dp/B0TEST').imageUrl).toBe(
      'https://m.media-amazon.com/high.jpg'
    )
  })

  it('extracts the dynamic landing image when no high-resolution URL exists', () => {
    const html =
      '<img id="landingImage" data-a-dynamic-image="{&quot;https://m.media-amazon.com/dynamic.jpg&quot;:[1000,1000]}" src="https://m.media-amazon.com/low.jpg">'
    expect(parseProductPage(html, 'https://www.amazon.com/dp/B0TEST').imageUrl).toBe(
      'https://m.media-amazon.com/dynamic.jpg'
    )
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
    expect(detectCaptcha('<html></html>', 'https://www.amazon.com/errors/validateCaptcha')).toBe(
      true
    )
    expect(detectCaptcha('<html></html>', 'https://www.amazon.com/captcha/verify')).toBe(true)
  })

  it('detects robot check message', () => {
    const html =
      '<html><body>To discuss automated access to Amazon data please contact us</body></html>'
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
    const html =
      '<html><body>This item cannot be shipped to your selected delivery location.</body></html>'
    expect(detectRegionBlock(html)).toBe(true)
  })

  it('detects not available in country', () => {
    const html = '<html><body>Not available in your country.</body></html>'
    expect(detectRegionBlock(html)).toBe(true)
  })

  it('detects the dispatched wording returned by Amazon Germany', () => {
    const html =
      '<html><body>This item cannot be dispatched to your selected delivery location.</body></html>'
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
