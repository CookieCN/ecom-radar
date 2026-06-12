import Database from 'better-sqlite3'
import { Alert, NewAlert } from '../types'

export class AlertsRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(data: NewAlert): Alert {
    const stmt = this.db.prepare(`
      INSERT INTO alerts (
        competitor_id, snapshot_id, previous_snapshot_id,
        alert_type, title, message, is_read
      ) VALUES (
        @competitor_id, @snapshot_id, @previous_snapshot_id,
        @alert_type, @title, @message, @is_read
      )
    `)
    const result = stmt.run(data)
    return this.findById(result.lastInsertRowid as number)!
  }

  findById(id: number): Alert | undefined {
    return this.db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as Alert | undefined
  }

  findByCompetitorId(competitorId: number, limit = 50): Alert[] {
    return this.db
      .prepare('SELECT * FROM alerts WHERE competitor_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(competitorId, limit) as Alert[]
  }

  findAll(limit = 100): Alert[] {
    return this.db
      .prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?')
      .all(limit) as Alert[]
  }

  findUnread(): Alert[] {
    return this.db
      .prepare('SELECT * FROM alerts WHERE is_read = 0 ORDER BY created_at DESC')
      .all() as Alert[]
  }

  countUnread(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as cnt FROM alerts WHERE is_read = 0')
      .get() as { cnt: number }
    return row.cnt
  }

  markAsRead(id: number): void {
    this.db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(id)
  }

  markAllAsRead(competitorId?: number): void {
    if (competitorId) {
      this.db.prepare('UPDATE alerts SET is_read = 1 WHERE competitor_id = ?').run(competitorId)
    } else {
      this.db.prepare('UPDATE alerts SET is_read = 1 WHERE is_read = 0').run()
    }
  }

  deleteByCompetitorId(competitorId: number): void {
    this.db.prepare('DELETE FROM alerts WHERE competitor_id = ?').run(competitorId)
  }
}
