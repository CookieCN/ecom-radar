import { describe, expect, it } from 'vitest'
import { parseSellerStoreUrl } from '../../src/storefront/store-url-parser'

describe('parseSellerStoreUrl', () => {
  it('parses seller profile URLs', () => {
    const result = parseSellerStoreUrl('https://www.amazon.com/sp?seller=A1234567890')
    expect(result).toMatchObject({ sellerId: 'A1234567890', marketplace: 'US' })
    expect(result.storefrontUrl).toContain('/s?me=A1234567890')
  })

  it('parses storefront URLs for localized marketplaces', () => {
    expect(parseSellerStoreUrl('https://www.amazon.de/s?me=A1DESELLER99').marketplace).toBe('DE')
    expect(parseSellerStoreUrl('https://www.amazon.co.jp/s?me=A1JPSELLER99').marketplace).toBe('JP')
  })

  it('rejects Brand Store URLs', () => {
    expect(() =>
      parseSellerStoreUrl('https://www.amazon.com/stores/page/ABC?seller=A1234567890')
    ).toThrow(/Brand Store/)
  })

  it('rejects URLs without a seller id', () => {
    expect(() => parseSellerStoreUrl('https://www.amazon.com/s?k=headphones')).toThrow(/Seller ID/)
  })
})
