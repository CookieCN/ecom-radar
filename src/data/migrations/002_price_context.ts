import Database from 'better-sqlite3'
import { Migration } from './types'

const migration: Migration = {
  version: 2,
  name: 'snapshot_price_context',
  up(db: Database.Database): void {
    db.exec(`
      ALTER TABLE snapshots ADD COLUMN price_type TEXT;
      ALTER TABLE snapshots ADD COLUMN regular_price REAL;
      ALTER TABLE snapshots ADD COLUMN list_price REAL;
      ALTER TABLE snapshots ADD COLUMN delivery_location TEXT;
    `)
  }
}

export default migration
