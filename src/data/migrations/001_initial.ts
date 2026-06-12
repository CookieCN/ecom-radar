import Database from 'better-sqlite3'
import { Migration } from './types'

const migration: Migration = {
  version: 1,
  name: 'initial_schema',
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS competitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asin TEXT NOT NULL,
        marketplace TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        image_url TEXT,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK(status IN ('active', 'paused', 'error')),
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_competitors_asin_marketplace
        ON competitors(asin, marketplace);

      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competitor_id INTEGER NOT NULL,
        title TEXT,
        price REAL,
        currency TEXT,
        rating REAL,
        review_count INTEGER,
        availability TEXT,
        image_url TEXT,
        captured_at TEXT NOT NULL DEFAULT (datetime('now')),
        capture_status TEXT NOT NULL DEFAULT 'success'
          CHECK(capture_status IN ('success', 'failed')),
        error_type TEXT,
        error_message TEXT,
        FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_competitor_id
        ON snapshots(competitor_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_captured_at
        ON snapshots(competitor_id, captured_at);

      CREATE TABLE IF NOT EXISTS monitor_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competitor_id INTEGER NOT NULL,
        interval_minutes INTEGER NOT NULL DEFAULT 360,
        next_run_at TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_monitor_jobs_competitor
        ON monitor_jobs(competitor_id);

      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competitor_id INTEGER NOT NULL,
        snapshot_id INTEGER,
        previous_snapshot_id INTEGER,
        alert_type TEXT NOT NULL
          CHECK(alert_type IN ('price_change', 'rating_drop', 'review_growth', 'availability_change')),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE,
        FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE SET NULL,
        FOREIGN KEY (previous_snapshot_id) REFERENCES snapshots(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_alerts_competitor_id
        ON alerts(competitor_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_is_read
        ON alerts(competitor_id, is_read);
      CREATE INDEX IF NOT EXISTS idx_alerts_created_at
        ON alerts(competitor_id, created_at);

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `)
  }
}

export default migration
