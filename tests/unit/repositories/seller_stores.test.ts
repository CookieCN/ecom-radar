import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb } from '../../helpers/db'
import { SellerStoresRepository } from '../../../src/data/repositories/seller_stores'

describe('SellerStoresRepository', () => {
  let db: Database.Database
  let repo: SellerStoresRepository
  beforeEach(() => {
    db = createTestDb()
    repo = new SellerStoresRepository(db)
  })
  afterEach(() => db.close())

  const addStore = () =>
    repo.create({
      seller_id: 'A1234567890',
      marketplace: 'US',
      profile_url: 'https://amazon.com/sp?seller=A1234567890',
      storefront_url: 'https://amazon.com/s?me=A1234567890',
      name: null,
      logo_url: null,
      status: 'active',
      consecutive_failures: 0,
      rotation_page: 2
    })
  const product = (asin: string) => ({
    asin,
    title: asin,
    image_url: null,
    listing_price: 10,
    currency: 'USD',
    rating: 4.5,
    review_count: 10,
    captured_at: new Date().toISOString(),
    page: 1
  })

  it('enforces marketplace and seller id uniqueness', () => {
    addStore()
    expect(() => addStore()).toThrow()
  })

  it('requires two complete same-scope misses before suspected missing', () => {
    const store = addStore()
    repo.upsertVisibleProduct(store.id, product('B0STORE001'))
    expect(repo.markMissing(store.id, [], [1], new Date().toISOString())).toHaveLength(0)
    expect(repo.markMissing(store.id, [], [1], new Date().toISOString())).toHaveLength(1)
    expect(repo.findProduct(store.id, 'B0STORE001')?.presence_status).toBe('suspected_missing')
  })

  it('restores a product and cascades store deletion', () => {
    const store = addStore()
    repo.upsertVisibleProduct(store.id, product('B0STORE001'))
    repo.markMissing(store.id, [], [1], new Date().toISOString())
    repo.markMissing(store.id, [], [1], new Date().toISOString())
    expect(repo.upsertVisibleProduct(store.id, product('B0STORE001')).restored).toBe(true)
    repo.createSnapshot({
      store_id: store.id,
      public_rating: null,
      feedback_count: null,
      positive_30d: null,
      positive_90d: null,
      positive_365d: null,
      reported_product_count: 1,
      scanned_product_count: 1,
      captured_at: new Date().toISOString(),
      capture_status: 'success',
      error_type: null,
      error_message: null
    })
    repo.delete(store.id)
    expect(
      (db.prepare('SELECT COUNT(*) count FROM seller_store_products').get() as { count: number })
        .count
    ).toBe(0)
    expect(
      (db.prepare('SELECT COUNT(*) count FROM seller_store_snapshots').get() as { count: number })
        .count
    ).toBe(0)
  })
})
