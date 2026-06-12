import Database from 'better-sqlite3'
import { Competitor, CompetitorStatus, NewCompetitor } from '../types'

export class CompetitorsRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(data: NewCompetitor): Competitor {
    const stmt = this.db.prepare(`
      INSERT INTO competitors (asin, marketplace, url, title, image_url, status, consecutive_failures)
      VALUES (@asin, @marketplace, @url, @title, @image_url, @status, @consecutive_failures)
    `)
    const result = stmt.run(data)
    return this.findById(result.lastInsertRowid as number)!
  }

  findById(id: number): Competitor | undefined {
    return this.db.prepare('SELECT * FROM competitors WHERE id = ?').get(id) as
      | Competitor
      | undefined
  }

  findByAsin(asin: string, marketplace: string): Competitor | undefined {
    return this.db
      .prepare('SELECT * FROM competitors WHERE asin = ? AND marketplace = ?')
      .get(asin, marketplace) as Competitor | undefined
  }

  findAll(status?: CompetitorStatus): Competitor[] {
    if (status) {
      return this.db
        .prepare('SELECT * FROM competitors WHERE status = ? ORDER BY updated_at DESC')
        .all(status) as Competitor[]
    }
    return this.db
      .prepare('SELECT * FROM competitors ORDER BY updated_at DESC')
      .all() as Competitor[]
  }

  update(id: number, data: Partial<Omit<Competitor, 'id'>>): Competitor | undefined {
    const fields: string[] = []
    const values: Record<string, unknown> = { id }

    if (data.asin !== undefined) {
      fields.push('asin = @asin')
      values.asin = data.asin
    }
    if (data.marketplace !== undefined) {
      fields.push('marketplace = @marketplace')
      values.marketplace = data.marketplace
    }
    if (data.url !== undefined) {
      fields.push('url = @url')
      values.url = data.url
    }
    if (data.title !== undefined) {
      fields.push('title = @title')
      values.title = data.title
    }
    if (data.image_url !== undefined) {
      fields.push('image_url = @image_url')
      values.image_url = data.image_url
    }
    if (data.status !== undefined) {
      fields.push('status = @status')
      values.status = data.status
    }
    if (data.consecutive_failures !== undefined) {
      fields.push('consecutive_failures = @consecutive_failures')
      values.consecutive_failures = data.consecutive_failures
    }

    if (fields.length === 0) return this.findById(id)

    fields.push("updated_at = datetime('now')")
    const sql = `UPDATE competitors SET ${fields.join(', ')} WHERE id = @id`

    this.db.prepare(sql).run(values)
    return this.findById(id)
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM competitors WHERE id = ?').run(id)
  }

  incrementFailures(id: number): void {
    this.db
      .prepare(
        "UPDATE competitors SET consecutive_failures = consecutive_failures + 1, updated_at = datetime('now') WHERE id = ?"
      )
      .run(id)
  }

  resetFailures(id: number): void {
    this.db
      .prepare(
        "UPDATE competitors SET consecutive_failures = 0, updated_at = datetime('now') WHERE id = ?"
      )
      .run(id)
  }

  updateStatus(id: number, status: CompetitorStatus): void {
    this.db
      .prepare("UPDATE competitors SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(status, id)
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM competitors').get() as {
      cnt: number
    }
    return row.cnt
  }
}
