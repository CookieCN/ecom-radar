import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createTestDb } from '../helpers/db'
import { SellerStoresRepository } from '../../src/data/repositories/seller_stores'

const mockSession = {
  load: vi.fn(),
  setDeliveryLocation: vi.fn(),
  close: vi.fn()
}

vi.mock('../../src/capture/browser', () => ({
  openAmazonPageSession: vi.fn(async () => mockSession)
}))

import { scanSellerStore } from '../../src/storefront/store-service'

const fixture = (name: string): string =>
  readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8')

describe('scanSellerStore delivery degradation', () => {
  let db: Database.Database
  let repo: SellerStoresRepository

  beforeEach(() => {
    db = createTestDb()
    repo = new SellerStoresRepository(db)
    vi.clearAllMocks()
    mockSession.load.mockImplementation(async (_url: string, pageType: string) => ({
      success: true,
      html:
        pageType === 'store_profile'
          ? fixture('seller-profile-us.html')
          : fixture('seller-listing.html'),
      finalUrl: 'https://www.amazon.com/'
    }))
    mockSession.setDeliveryLocation.mockResolvedValue({
      success: false,
      errorType: 'DELIVERY_LOCATION_FAILED',
      errorMessage:
        'delivery dialog opened but no postal input was found. Dialog text: "Choose your location Done"'
    })
    mockSession.close.mockResolvedValue(undefined)
  })

  afterEach(() => db.close())

  it('keeps catalog discovery when detail delivery setup fails', async () => {
    const store = repo.create({
      seller_id: 'A3LYEXNF4R76R',
      marketplace: 'US',
      profile_url: 'https://www.amazon.com/sp?seller=A3LYEXNF4R76R',
      storefront_url: 'https://www.amazon.com/s?me=A3LYEXNF4R76R',
      name: null,
      logo_url: null,
      status: 'active',
      consecutive_failures: 0,
      rotation_page: 2
    })
    repo.ensureJob(store.id)

    const result = await scanSellerStore(db, store, {
      sleep: async () => {},
      random: () => 0
    })

    expect(result).toMatchObject({
      success: true,
      scannedProducts: 2,
      deepProducts: 0,
      errorType: 'DELIVERY_LOCATION_FAILED'
    })
    expect(repo.latestSnapshot(store.id)?.capture_status).toBe('partial')
    expect(repo.listProducts(store.id)).toHaveLength(2)
    expect(repo.listProducts(store.id).every((product) => product.listing_price === null)).toBe(
      true
    )
    expect(repo.findById(store.id)?.status).toBe('active')
  })
})
