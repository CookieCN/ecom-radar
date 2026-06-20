import { getMarketplaceByDomain } from '../shared/marketplaces'

export interface ParsedSellerStoreUrl {
  sellerId: string
  marketplace: string
  profileUrl: string
  storefrontUrl: string
}

export function parseSellerStoreUrl(input: string): ParsedSellerStoreUrl {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new Error('Enter a valid Amazon seller storefront or seller profile URL.')
  }

  const config = getMarketplaceByDomain(url.hostname)
  if (!config) throw new Error('The URL is not from a supported Amazon marketplace.')
  if (/\/stores\//i.test(url.pathname)) {
    throw new Error('Brand Store URLs are not supported yet. Add a Seller Storefront URL.')
  }

  const sellerId = ['seller', 'me', 'merchant', 'm']
    .map((key) => url.searchParams.get(key))
    .find(Boolean)
    ?.trim()
  if (!sellerId || !/^[A-Z0-9]{8,32}$/i.test(sellerId)) {
    throw new Error('Could not find a valid Seller ID in this URL.')
  }

  const host = `https://www.${config.domain}`
  return {
    sellerId,
    marketplace: config.code,
    profileUrl: `${host}/sp?seller=${encodeURIComponent(sellerId)}`,
    storefrontUrl: `${host}/s?me=${encodeURIComponent(sellerId)}`
  }
}
