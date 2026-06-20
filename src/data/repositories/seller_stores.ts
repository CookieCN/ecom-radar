import Database from 'better-sqlite3'
import type {
  NewSellerStore,
  NewSellerStoreSnapshot,
  SellerStore,
  SellerStoreEvent,
  SellerStoreProduct,
  SellerStoreSnapshot,
  StoreEventType
} from '../types'

export interface StoreProductInput {
  asin: string
  title: string | null
  image_url: string | null
  listing_price: number | null
  currency: string | null
  rating: number | null
  review_count: number | null
  captured_at: string
  page: number
}

export class SellerStoresRepository {
  constructor(private db: Database.Database) {}

  create(input: NewSellerStore): SellerStore {
    const result = this.db
      .prepare(
        `INSERT INTO seller_stores
         (seller_id, marketplace, profile_url, storefront_url, name, logo_url, status,
          consecutive_failures, rotation_page)
         VALUES (@seller_id, @marketplace, @profile_url, @storefront_url, @name, @logo_url,
          @status, @consecutive_failures, @rotation_page)`
      )
      .run(input)
    return this.findById(Number(result.lastInsertRowid))!
  }

  findById(id: number): SellerStore | undefined {
    return this.db.prepare('SELECT * FROM seller_stores WHERE id = ?').get(id) as
      | SellerStore
      | undefined
  }

  findBySellerId(sellerId: string, marketplace: string): SellerStore | undefined {
    return this.db
      .prepare('SELECT * FROM seller_stores WHERE seller_id = ? AND marketplace = ?')
      .get(sellerId, marketplace) as SellerStore | undefined
  }

  findAll(): SellerStore[] {
    return this.db
      .prepare('SELECT * FROM seller_stores ORDER BY updated_at DESC')
      .all() as SellerStore[]
  }

  findActive(): SellerStore[] {
    return this.db
      .prepare("SELECT * FROM seller_stores WHERE status = 'active' ORDER BY id")
      .all() as SellerStore[]
  }

  update(
    id: number,
    fields: Partial<
      Pick<SellerStore, 'name' | 'logo_url' | 'status' | 'rotation_page' | 'consecutive_failures'>
    >
  ): SellerStore {
    const entries = Object.entries(fields)
    if (entries.length) {
      this.db
        .prepare(
          `UPDATE seller_stores SET ${entries.map(([key]) => `${key} = @${key}`).join(', ')},
           updated_at = datetime('now') WHERE id = @id`
        )
        .run({ id, ...fields })
    }
    return this.findById(id)!
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM seller_stores WHERE id = ?').run(id)
  }

  createSnapshot(input: NewSellerStoreSnapshot): SellerStoreSnapshot {
    const result = this.db
      .prepare(
        `INSERT INTO seller_store_snapshots
         (store_id, public_rating, feedback_count, positive_30d, positive_90d, positive_365d,
          reported_product_count, scanned_product_count, captured_at, capture_status, error_type, error_message)
         VALUES (@store_id, @public_rating, @feedback_count, @positive_30d, @positive_90d,
          @positive_365d, @reported_product_count, @scanned_product_count, @captured_at,
          @capture_status, @error_type, @error_message)`
      )
      .run(input)
    return this.db
      .prepare('SELECT * FROM seller_store_snapshots WHERE id = ?')
      .get(result.lastInsertRowid) as SellerStoreSnapshot
  }

  latestSnapshot(storeId: number): SellerStoreSnapshot | undefined {
    return this.db
      .prepare(
        'SELECT * FROM seller_store_snapshots WHERE store_id = ? ORDER BY captured_at DESC, id DESC LIMIT 1'
      )
      .get(storeId) as SellerStoreSnapshot | undefined
  }

  listProducts(storeId: number): SellerStoreProduct[] {
    return this.db
      .prepare(
        'SELECT * FROM seller_store_products WHERE store_id = ? ORDER BY last_seen_at DESC, id DESC'
      )
      .all(storeId) as SellerStoreProduct[]
  }

  findProduct(storeId: number, asin: string): SellerStoreProduct | undefined {
    return this.db
      .prepare('SELECT * FROM seller_store_products WHERE store_id = ? AND asin = ?')
      .get(storeId, asin) as SellerStoreProduct | undefined
  }

  findProductById(id: number): SellerStoreProduct | undefined {
    return this.db.prepare('SELECT * FROM seller_store_products WHERE id = ?').get(id) as
      | SellerStoreProduct
      | undefined
  }

  upsertVisibleProduct(
    storeId: number,
    input: StoreProductInput
  ): { product: SellerStoreProduct; isNew: boolean; restored: boolean } {
    const current = this.findProduct(storeId, input.asin)
    if (!current) {
      const result = this.db
        .prepare(
          `INSERT INTO seller_store_products
           (store_id, asin, title, image_url, listing_price, currency, rating, review_count,
            first_seen_at, last_seen_at, listing_captured_at, last_seen_page)
           VALUES (?, @asin, @title, @image_url, @listing_price, @currency, @rating,
            @review_count, @captured_at, @captured_at, @captured_at, @page)`
        )
        .run(storeId, input)
      return {
        product: this.db
          .prepare('SELECT * FROM seller_store_products WHERE id = ?')
          .get(result.lastInsertRowid) as SellerStoreProduct,
        isNew: true,
        restored: false
      }
    }

    const restored = current.presence_status === 'suspected_missing'
    this.db
      .prepare(
        `UPDATE seller_store_products SET title=@title, image_url=@image_url,
         listing_price=@listing_price, currency=@currency, rating=@rating, review_count=@review_count,
         presence_status='visible', missing_count=0, last_seen_at=@captured_at,
         listing_captured_at=@captured_at, last_seen_page=@page, updated_at=datetime('now') WHERE id=@id`
      )
      .run({ ...input, id: current.id })
    return { product: this.findProduct(storeId, input.asin)!, isNew: false, restored }
  }

  markMissing(
    storeId: number,
    visibleAsins: string[],
    scannedPages: number[],
    capturedAt: string
  ): SellerStoreProduct[] {
    const visible = new Set(visibleAsins)
    const newlyMissing: SellerStoreProduct[] = []
    for (const product of this.listProducts(storeId)) {
      if (visible.has(product.asin) || product.presence_status === 'suspected_missing') continue
      if (product.last_seen_page === null || !scannedPages.includes(product.last_seen_page))
        continue
      const nextCount = product.missing_count + 1
      this.db
        .prepare(
          `UPDATE seller_store_products SET missing_count=?, presence_status=?, updated_at=? WHERE id=?`
        )
        .run(nextCount, nextCount >= 2 ? 'suspected_missing' : 'visible', capturedAt, product.id)
      if (nextCount >= 2) newlyMissing.push(this.findProduct(storeId, product.asin)!)
    }
    return newlyMissing
  }

  updateDetail(
    id: number,
    fields: Partial<
      Pick<
        SellerStoreProduct,
        | 'detail_price'
        | 'regular_price'
        | 'list_price'
        | 'brand'
        | 'category'
        | 'coupon'
        | 'deal_type'
        | 'availability'
      >
    >,
    capturedAt: string
  ): void {
    const entries = Object.entries(fields)
    if (!entries.length) return
    this.db
      .prepare(
        `UPDATE seller_store_products SET ${entries.map(([key]) => `${key}=@${key}`).join(', ')},
         detail_captured_at=@capturedAt, updated_at=datetime('now') WHERE id=@id`
      )
      .run({ id, capturedAt, ...fields })
  }

  setWatched(id: number, watched: boolean): void {
    this.db
      .prepare('UPDATE seller_store_products SET is_watched=? WHERE id=?')
      .run(watched ? 1 : 0, id)
  }

  createEvent(
    storeId: number,
    productId: number | null,
    eventType: StoreEventType,
    oldValue: string | null = null,
    newValue: string | null = null
  ): SellerStoreEvent {
    const result = this.db
      .prepare(
        `INSERT INTO seller_store_events (store_id, product_id, event_type, old_value, new_value)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(storeId, productId, eventType, oldValue, newValue)
    return this.db
      .prepare('SELECT * FROM seller_store_events WHERE id=?')
      .get(result.lastInsertRowid) as SellerStoreEvent
  }

  listEvents(storeId: number, limit = 100): SellerStoreEvent[] {
    return this.db
      .prepare(
        'SELECT * FROM seller_store_events WHERE store_id=? ORDER BY detected_at DESC, id DESC LIMIT ?'
      )
      .all(storeId, limit) as SellerStoreEvent[]
  }

  ensureJob(storeId: number): void {
    this.db
      .prepare(
        'INSERT OR IGNORE INTO seller_store_jobs (store_id, next_run_at, enabled) VALUES (?, NULL, 1)'
      )
      .run(storeId)
  }

  updateJob(storeId: number, nextRunAt: string | null, deferredReason: string | null): void {
    this.db
      .prepare(
        "UPDATE seller_store_jobs SET next_run_at=?, deferred_reason=?, updated_at=datetime('now') WHERE store_id=?"
      )
      .run(nextRunAt, deferredReason, storeId)
  }

  dueStores(): SellerStore[] {
    return this.db
      .prepare(
        `SELECT s.* FROM seller_stores s JOIN seller_store_jobs j ON j.store_id=s.id
         WHERE s.status='active' AND j.enabled=1
           AND (j.next_run_at IS NULL OR datetime(j.next_run_at) <= datetime('now')) ORDER BY s.id`
      )
      .all() as SellerStore[]
  }
}
