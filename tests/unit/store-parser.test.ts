import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseStoreListing, parseStoreProfile } from '../../src/storefront/store-parser'

const fixture = (name: string): string =>
  readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8')

describe('seller store parsers', () => {
  it('extracts US seller feedback', () => {
    expect(parseStoreProfile(fixture('seller-profile-us.html'))).toEqual({
      name: 'Wilson Outdoor Store',
      logoUrl: 'https://images-na.ssl-images-amazon.com/store-logo.jpg',
      publicRating: 4.8,
      feedbackCount: 1245,
      positive30d: 98,
      positive90d: 97,
      positive365d: 96
    })
  })

  it('extracts localized German feedback', () => {
    const result = parseStoreProfile(fixture('seller-profile-de.html'))
    expect(result.publicRating).toBe(4.7)
    expect(result.feedbackCount).toBe(987)
    expect(result.positive365d).toBe(97)
  })

  it('extracts localized Japanese feedback', () => {
    const result = parseStoreProfile(fixture('seller-profile-jp.html'))
    expect(result.name).toBe('Tokyo Seller')
    expect(result.publicRating).toBe(4.6)
    expect(result.feedbackCount).toBe(876)
    expect(result.positive30d).toBe(99)
    expect(result.positive365d).toBe(97)
  })

  it('extracts product cards and page-reported count', () => {
    const result = parseStoreListing(fixture('seller-listing.html'))
    expect(result.reportedProductCount).toBe(1234)
    expect(result.products).toHaveLength(2)
    expect(result.products[0]).toMatchObject({
      asin: 'B0STORE001',
      title: 'First Product',
      price: 29.99,
      rating: 4.5,
      reviewCount: 123
    })
    expect(result.products[1]).toMatchObject({
      asin: 'B0STORE002',
      price: 19.95,
      rating: 4.2,
      reviewCount: 45
    })
  })
})
