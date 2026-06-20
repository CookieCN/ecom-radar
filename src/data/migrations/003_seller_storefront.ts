import Database from 'better-sqlite3'
import { Migration } from './types'

const migration: Migration = {
  version: 3,
  name: 'seller_storefront_monitoring',
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE seller_stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id TEXT NOT NULL,
        marketplace TEXT NOT NULL,
        profile_url TEXT NOT NULL,
        storefront_url TEXT NOT NULL,
        name TEXT,
        logo_url TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'error')),
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        rotation_page INTEGER NOT NULL DEFAULT 2,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(marketplace, seller_id)
      );

      CREATE TABLE seller_store_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL,
        public_rating REAL,
        feedback_count INTEGER,
        positive_30d REAL,
        positive_90d REAL,
        positive_365d REAL,
        reported_product_count INTEGER,
        scanned_product_count INTEGER NOT NULL DEFAULT 0,
        captured_at TEXT NOT NULL DEFAULT (datetime('now')),
        capture_status TEXT NOT NULL CHECK(capture_status IN ('success', 'failed', 'partial')),
        error_type TEXT,
        error_message TEXT,
        FOREIGN KEY (store_id) REFERENCES seller_stores(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_store_snapshots_store_time ON seller_store_snapshots(store_id, captured_at DESC);

      CREATE TABLE seller_store_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL,
        asin TEXT NOT NULL,
        title TEXT,
        image_url TEXT,
        listing_price REAL,
        currency TEXT,
        rating REAL,
        review_count INTEGER,
        brand TEXT,
        category TEXT,
        detail_price REAL,
        regular_price REAL,
        list_price REAL,
        coupon TEXT,
        deal_type TEXT,
        availability TEXT,
        is_watched INTEGER NOT NULL DEFAULT 0,
        presence_status TEXT NOT NULL DEFAULT 'visible' CHECK(presence_status IN ('visible', 'suspected_missing')),
        missing_count INTEGER NOT NULL DEFAULT 0,
        first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
        listing_captured_at TEXT,
        detail_captured_at TEXT,
        last_seen_page INTEGER,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(store_id, asin),
        FOREIGN KEY (store_id) REFERENCES seller_stores(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_store_products_store_status ON seller_store_products(store_id, presence_status);

      CREATE TABLE seller_store_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL,
        product_id INTEGER,
        event_type TEXT NOT NULL CHECK(event_type IN ('new_visible', 'suspected_missing', 'restored', 'price_changed', 'promotion_changed', 'availability_changed')),
        old_value TEXT,
        new_value TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        detected_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (store_id) REFERENCES seller_stores(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES seller_store_products(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_store_events_store_time ON seller_store_events(store_id, detected_at DESC);

      CREATE TABLE seller_store_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL UNIQUE,
        next_run_at TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        deferred_reason TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (store_id) REFERENCES seller_stores(id) ON DELETE CASCADE
      );

      CREATE TABLE page_access_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        marketplace TEXT NOT NULL,
        page_type TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id INTEGER,
        result TEXT NOT NULL DEFAULT 'reserved',
        error_type TEXT,
        accessed_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_page_access_day ON page_access_log(accessed_at);

      CREATE TABLE marketplace_cooldowns (
        marketplace TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        ends_at TEXT NOT NULL
      );
    `)
  }
}

export default migration
