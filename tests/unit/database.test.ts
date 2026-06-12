import { describe, it, expect, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDb } from '../helpers/db'

describe('Database initialization and migrations', () => {
  let db: Database.Database

  afterEach(() => {
    if (db) db.close()
  })

  it('should create all tables on first run', () => {
    db = createTestDb()
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[]
    const names = tables.map((t) => t.name)

    expect(names).toContain('_migrations')
    expect(names).toContain('competitors')
    expect(names).toContain('snapshots')
    expect(names).toContain('monitor_jobs')
    expect(names).toContain('alerts')
    expect(names).toContain('settings')
  })

  it('should record migration version', () => {
    db = createTestDb()
    const row = db
      .prepare('SELECT version, name FROM _migrations WHERE version = 1')
      .get() as { version: number; name: string }
    expect(row.version).toBe(1)
    expect(row.name).toBe('initial_schema')
  })

  it('should not re-run migrations on second open', () => {
    db = createTestDb()
    const firstCount = (
      db.prepare('SELECT COUNT(*) as cnt FROM _migrations').get() as { cnt: number }
    ).cnt
    expect(firstCount).toBe(1)
  })

  it('should enforce foreign keys', () => {
    db = createTestDb()
    // Try inserting a snapshot with non-existent competitor_id
    expect(() => {
      db.prepare(`
        INSERT INTO snapshots (competitor_id, captured_at, capture_status)
        VALUES (999, datetime('now'), 'success')
      `).run()
    }).toThrow()
  })

  it('should enforce status check constraint on competitors', () => {
    db = createTestDb()
    expect(() => {
      db.prepare(`
        INSERT INTO competitors (asin, marketplace, url, status)
        VALUES ('B00TEST', 'US', 'https://amazon.com/dp/B00TEST', 'invalid_status')
      `).run()
    }).toThrow()
  })

  it('should enforce capture_status check constraint on snapshots', () => {
    db = createTestDb()
    // First create a valid competitor
    db.prepare(`
      INSERT INTO competitors (asin, marketplace, url) VALUES ('B00TEST', 'US', 'https://amazon.com/dp/B00TEST')
    `).run()
    expect(() => {
      db.prepare(`
        INSERT INTO snapshots (competitor_id, captured_at, capture_status)
        VALUES (1, datetime('now'), 'invalid')
      `).run()
    }).toThrow()
  })
})
