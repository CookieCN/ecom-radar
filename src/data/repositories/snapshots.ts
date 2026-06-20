import Database from 'better-sqlite3'
import { NewSnapshot, Snapshot } from '../types'

export class SnapshotsRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(data: NewSnapshot): Snapshot {
    const stmt = this.db.prepare(`
      INSERT INTO snapshots (
        competitor_id, title, price, currency, price_type, regular_price, list_price,
        delivery_location, rating, review_count,
        availability, image_url, captured_at, capture_status, error_type, error_message
      ) VALUES (
        @competitor_id, @title, @price, @currency, @price_type, @regular_price, @list_price,
        @delivery_location, @rating, @review_count,
        @availability, @image_url, @captured_at, @capture_status, @error_type, @error_message
      )
    `)
    const result = stmt.run({
      ...data,
      price_type: data.price_type ?? null,
      regular_price: data.regular_price ?? null,
      list_price: data.list_price ?? null,
      delivery_location: data.delivery_location ?? null
    })
    return this.findById(result.lastInsertRowid as number)!
  }

  findById(id: number): Snapshot | undefined {
    return this.db.prepare('SELECT * FROM snapshots WHERE id = ?').get(id) as Snapshot | undefined
  }

  findByCompetitorId(competitorId: number, limit = 100): Snapshot[] {
    return this.db
      .prepare('SELECT * FROM snapshots WHERE competitor_id = ? ORDER BY captured_at DESC LIMIT ?')
      .all(competitorId, limit) as Snapshot[]
  }

  findLatest(competitorId: number): Snapshot | undefined {
    return this.db
      .prepare('SELECT * FROM snapshots WHERE competitor_id = ? ORDER BY captured_at DESC LIMIT 1')
      .get(competitorId) as Snapshot | undefined
  }

  findPrevious(competitorId: number, snapshotId: number): Snapshot | undefined {
    return this.db
      .prepare(
        `SELECT * FROM snapshots
         WHERE competitor_id = ? AND id < ? AND capture_status = 'success'
         ORDER BY captured_at DESC LIMIT 1`
      )
      .get(competitorId, snapshotId) as Snapshot | undefined
  }

  findAllSuccessful(competitorId: number): Snapshot[] {
    return this.db
      .prepare(
        `SELECT * FROM snapshots
         WHERE competitor_id = ? AND capture_status = 'success'
         ORDER BY captured_at ASC`
      )
      .all(competitorId) as Snapshot[]
  }

  findByDateRange(competitorId: number, sinceDays: number): Snapshot[] {
    return this.db
      .prepare(
        `SELECT * FROM snapshots
         WHERE competitor_id = ? AND capture_status = 'success'
           AND captured_at >= datetime('now', '-' || ? || ' days')
         ORDER BY captured_at ASC`
      )
      .all(competitorId, sinceDays) as Snapshot[]
  }

  countByCompetitorId(competitorId: number): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as cnt FROM snapshots WHERE competitor_id = ?')
      .get(competitorId) as { cnt: number }
    return row.cnt
  }

  deleteByCompetitorId(competitorId: number): void {
    this.db.prepare('DELETE FROM snapshots WHERE competitor_id = ?').run(competitorId)
  }
}
