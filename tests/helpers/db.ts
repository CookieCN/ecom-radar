import Database from 'better-sqlite3'
import migration001 from '../../src/data/migrations/001_initial'

export function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')

  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Run initial migration
  migration001.up(db)
  db.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)').run(
    migration001.version,
    migration001.name
  )

  return db
}
