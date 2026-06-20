import Database from 'better-sqlite3'
import path from 'path'
import { mkdirSync } from 'fs'
import { app } from 'electron'
import { Migration } from './migrations/types'
import migration001 from './migrations/001_initial'
import migration002 from './migrations/002_price_context'
import migration003 from './migrations/003_seller_storefront'

const MIGRATIONS: Migration[] = [migration001, migration002, migration003]

let _db: Database.Database | null = null

export function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'ecom-radar.db')
}

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
}

function getAppliedVersions(db: Database.Database): Set<number> {
  const rows = db.prepare('SELECT version FROM _migrations ORDER BY version').all() as {
    version: number
  }[]
  return new Set(rows.map((r) => r.version))
}

function runMigrations(db: Database.Database): void {
  ensureMigrationsTable(db)
  const applied = getAppliedVersions(db)

  const pending = MIGRATIONS.filter((m) => !applied.has(m.version))

  if (pending.length === 0) return

  const applyMigration = db.transaction(() => {
    for (const migration of pending) {
      migration.up(db)
      db.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)').run(
        migration.version,
        migration.name
      )
    }
  })

  applyMigration()
}

export function initDatabase(dbPath?: string): Database.Database {
  if (_db) return _db

  const resolvedPath = dbPath ?? getDbPath()

  if (resolvedPath !== ':memory:') {
    mkdirSync(path.dirname(resolvedPath), { recursive: true })
  }

  _db = new Database(resolvedPath)

  // Performance pragmas
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  _db.pragma('busy_timeout = 5000')

  runMigrations(_db)

  return _db
}

export function getDatabase(): Database.Database {
  if (!_db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return _db
}

export function closeDatabase(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}
