import Database from 'better-sqlite3'
import { Setting } from '../types'

export class SettingsRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  get(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value
  }

  getOrDefault(key: string, defaultValue: string): string {
    return this.get(key) ?? defaultValue
  }

  set(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      )
      .run(key, value)
  }

  setMultiple(entries: Record<string, string>): void {
    const upsert = this.db.transaction(() => {
      for (const [key, value] of Object.entries(entries)) {
        this.set(key, value)
      }
    })
    upsert()
  }

  delete(key: string): void {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key)
  }

  getAll(): Setting[] {
    return this.db.prepare('SELECT * FROM settings ORDER BY key').all() as Setting[]
  }

  getAllAsMap(): Record<string, string> {
    const rows = this.getAll()
    const map: Record<string, string> = {}
    for (const row of rows) {
      map[row.key] = row.value
    }
    return map
  }

  getBoolean(key: string, defaultValue = false): boolean {
    const value = this.get(key)
    if (value === undefined) return defaultValue
    return value === 'true' || value === '1'
  }

  setBoolean(key: string, value: boolean): void {
    this.set(key, value ? 'true' : 'false')
  }

  getNumber(key: string, defaultValue = 0): number {
    const value = this.get(key)
    if (value === undefined) return defaultValue
    const parsed = Number(value)
    return Number.isNaN(parsed) ? defaultValue : parsed
  }

  setNumber(key: string, value: number): void {
    this.set(key, String(value))
  }
}
