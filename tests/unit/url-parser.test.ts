import { describe, it, expect } from 'vitest'
import { parseAmazonInput, ParsedProduct } from '../../src/capture/url-parser'

function ok(input: string, expected: ParsedProduct): void {
  const result = parseAmazonInput(input)
  expect(result.success).toBe(true)
  if (result.success) {
    expect(result.data.asin).toBe(expected.asin)
    expect(result.data.marketplace).toBe(expected.marketplace)
    expect(result.data.url).toBe(expected.url)
  }
}

function fail(input: string, contains?: string): void {
  const result = parseAmazonInput(input)
  expect(result.success).toBe(false)
  if (!result.success && contains) {
    expect(result.error.toLowerCase()).toContain(contains.toLowerCase())
  }
}

// ============================================================
describe('parseAmazonInput — URL parsing', () => {
  describe('amazon.com', () => {
    it('parses /dp/ASIN', () => {
      ok('https://www.amazon.com/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'US',
        url: 'https://www.amazon.com/dp/B0EXAMPLE1'
      })
    })

    it('parses /gp/product/ASIN', () => {
      ok('https://www.amazon.com/gp/product/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'US',
        url: 'https://www.amazon.com/dp/B0EXAMPLE1'
      })
    })

    it('parses /dp/ASIN with trailing slash', () => {
      ok('https://www.amazon.com/dp/B0EXAMPLE1/', {
        asin: 'B0EXAMPLE1',
        marketplace: 'US',
        url: 'https://www.amazon.com/dp/B0EXAMPLE1'
      })
    })

    it('parses /dp/ASIN with product title in path', () => {
      ok('https://www.amazon.com/Some-Product-Name/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'US',
        url: 'https://www.amazon.com/dp/B0EXAMPLE1'
      })
    })

    it('parses /dp/ASIN with ref query param', () => {
      ok('https://www.amazon.com/dp/B0EXAMPLE1?ref=nav_ya_signin', {
        asin: 'B0EXAMPLE1',
        marketplace: 'US',
        url: 'https://www.amazon.com/dp/B0EXAMPLE1'
      })
    })

    it('parses /dp/ASIN with th and psc query params', () => {
      ok('https://www.amazon.com/dp/B0EXAMPLE1?th=1&psc=1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'US',
        url: 'https://www.amazon.com/dp/B0EXAMPLE1'
      })
    })

    it('parses without www prefix', () => {
      ok('https://amazon.com/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'US',
        url: 'https://www.amazon.com/dp/B0EXAMPLE1'
      })
    })

    it('parses smile.amazon.com', () => {
      ok('https://smile.amazon.com/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'US',
        url: 'https://www.amazon.com/dp/B0EXAMPLE1'
      })
    })

    it('parses amzn.com short URL', () => {
      ok('https://amzn.com/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'US',
        url: 'https://www.amazon.com/dp/B0EXAMPLE1'
      })
    })
  })

  describe('international marketplaces', () => {
    it('parses amazon.co.uk', () => {
      ok('https://www.amazon.co.uk/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'UK',
        url: 'https://www.amazon.co.uk/dp/B0EXAMPLE1'
      })
    })

    it('parses amazon.de', () => {
      ok('https://www.amazon.de/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'DE',
        url: 'https://www.amazon.de/dp/B0EXAMPLE1'
      })
    })

    it('parses amazon.fr', () => {
      ok('https://www.amazon.fr/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'FR',
        url: 'https://www.amazon.fr/dp/B0EXAMPLE1'
      })
    })

    it('parses amazon.co.jp', () => {
      ok('https://www.amazon.co.jp/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'JP',
        url: 'https://www.amazon.co.jp/dp/B0EXAMPLE1'
      })
    })

    it('parses amazon.ca', () => {
      ok('https://www.amazon.ca/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'CA',
        url: 'https://www.amazon.ca/dp/B0EXAMPLE1'
      })
    })

    it('parses amazon.it', () => {
      ok('https://www.amazon.it/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'IT',
        url: 'https://www.amazon.it/dp/B0EXAMPLE1'
      })
    })

    it('parses amazon.es', () => {
      ok('https://www.amazon.es/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'ES',
        url: 'https://www.amazon.es/dp/B0EXAMPLE1'
      })
    })

    it('parses amazon.in', () => {
      ok('https://www.amazon.in/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'IN',
        url: 'https://www.amazon.in/dp/B0EXAMPLE1'
      })
    })

    it('parses amazon.com.au', () => {
      ok('https://www.amazon.com.au/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'AU',
        url: 'https://www.amazon.com.au/dp/B0EXAMPLE1'
      })
    })

    it('parses amazon.com.br', () => {
      ok('https://www.amazon.com.br/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'BR',
        url: 'https://www.amazon.com.br/dp/B0EXAMPLE1'
      })
    })

    it('parses amazon.com.mx', () => {
      ok('https://www.amazon.com.mx/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'MX',
        url: 'https://www.amazon.com.mx/dp/B0EXAMPLE1'
      })
    })

    it('parses amazon.ae', () => {
      ok('https://www.amazon.ae/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'AE',
        url: 'https://www.amazon.ae/dp/B0EXAMPLE1'
      })
    })
  })

  describe('URL with protocol variations', () => {
    it('parses http:// URL', () => {
      ok('http://www.amazon.com/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'US',
        url: 'https://www.amazon.com/dp/B0EXAMPLE1'
      })
    })

    it('parses URL without protocol', () => {
      ok('www.amazon.com/dp/B0EXAMPLE1', {
        asin: 'B0EXAMPLE1',
        marketplace: 'US',
        url: 'https://www.amazon.com/dp/B0EXAMPLE1'
      })
    })
  })
})

// ============================================================
describe('parseAmazonInput — bare ASIN', () => {
  it('parses uppercase ASIN', () => {
    ok('B0EXAMPLE1', {
      asin: 'B0EXAMPLE1',
      marketplace: 'US',
      url: 'https://www.amazon.com/dp/B0EXAMPLE1'
    })
  })

  it('parses lowercase ASIN', () => {
    ok('b0example1', {
      asin: 'B0EXAMPLE1',
      marketplace: 'US',
      url: 'https://www.amazon.com/dp/B0EXAMPLE1'
    })
  })

  it('parses mixed case ASIN', () => {
    ok('B0exAmPlE1', {
      asin: 'B0EXAMPLE1',
      marketplace: 'US',
      url: 'https://www.amazon.com/dp/B0EXAMPLE1'
    })
  })

  it('parses ASIN with surrounding whitespace', () => {
    ok('  B0EXAMPLE1  ', {
      asin: 'B0EXAMPLE1',
      marketplace: 'US',
      url: 'https://www.amazon.com/dp/B0EXAMPLE1'
    })
  })

  it('parses a real-looking ASIN', () => {
    ok('B09N3YBZ7D', {
      asin: 'B09N3YBZ7D',
      marketplace: 'US',
      url: 'https://www.amazon.com/dp/B09N3YBZ7D'
    })
  })
})

// ============================================================
describe('parseAmazonInput — error cases', () => {
  describe('invalid ASIN format', () => {
    it('rejects ASIN with wrong length (too short)', () => {
      fail('B0SHORT', '10 characters')
    })

    it('rejects ASIN with wrong length (too long)', () => {
      fail('B0TOOLONG123', '10 characters')
    })

    it('rejects ASIN not starting with B', () => {
      fail('A0EXAMPLE1', 'start with "B"')
    })

    it('rejects ASIN with special characters', () => {
      fail('B0EXA!PLE1', 'invalid asin format')
    })

    it('rejects ASIN with spaces in middle', () => {
      fail('B0EX AMPLE1', '10 characters')
    })
  })

  describe('invalid URLs', () => {
    it('rejects non-Amazon URL', () => {
      fail('https://www.ebay.com/itm/something', 'not an amazon url')
    })

    it('rejects amazon URL without ASIN', () => {
      fail('https://www.amazon.com/', 'could not find an asin')
    })

    it('rejects amazon search URL', () => {
      fail('https://www.amazon.com/s?k=headphones', 'could not find an asin')
    })

    it('rejects empty input', () => {
      fail('', 'empty')
    })

    it('rejects whitespace-only input', () => {
      fail('   ', 'empty')
    })
  })

  describe('edge cases', () => {
    it('rejects random text', () => {
      fail('hello world')
    })

    it('rejects number-only input', () => {
      fail('1234567890')
    })

    it('rejects input that is just "B"', () => {
      fail('B')
    })
  })
})

// ============================================================
describe('parseAmazonInput — /gp/product/ and /product/ paths', () => {
  it('parses /gp/product/ASIN', () => {
    ok('https://www.amazon.com/gp/product/B0EXAMPLE1', {
      asin: 'B0EXAMPLE1',
      marketplace: 'US',
      url: 'https://www.amazon.com/dp/B0EXAMPLE1'
    })
  })

  it('parses /gp/product/ASIN on amazon.de', () => {
    ok('https://www.amazon.de/gp/product/B0EXAMPLE1', {
      asin: 'B0EXAMPLE1',
      marketplace: 'DE',
      url: 'https://www.amazon.de/dp/B0EXAMPLE1'
    })
  })

  it('parses /product/ASIN path', () => {
    ok('https://www.amazon.com/product/B0EXAMPLE1', {
      asin: 'B0EXAMPLE1',
      marketplace: 'US',
      url: 'https://www.amazon.com/dp/B0EXAMPLE1'
    })
  })
})
