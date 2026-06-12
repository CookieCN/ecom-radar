import Database from 'better-sqlite3'
import { MonitorJob, NewMonitorJob } from '../types'

export class MonitorJobsRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(data: NewMonitorJob): MonitorJob {
    const stmt = this.db.prepare(`
      INSERT INTO monitor_jobs (competitor_id, interval_minutes, next_run_at, enabled)
      VALUES (@competitor_id, @interval_minutes, @next_run_at, @enabled)
    `)
    const result = stmt.run(data)
    return this.findById(result.lastInsertRowid as number)!
  }

  findById(id: number): MonitorJob | undefined {
    return this.db.prepare('SELECT * FROM monitor_jobs WHERE id = ?').get(id) as
      | MonitorJob
      | undefined
  }

  findByCompetitorId(competitorId: number): MonitorJob | undefined {
    return this.db
      .prepare('SELECT * FROM monitor_jobs WHERE competitor_id = ?')
      .get(competitorId) as MonitorJob | undefined
  }

  findAllEnabled(): MonitorJob[] {
    return this.db
      .prepare('SELECT * FROM monitor_jobs WHERE enabled = 1')
      .all() as MonitorJob[]
  }

  findAllDue(): MonitorJob[] {
    return this.db
      .prepare(
        `SELECT * FROM monitor_jobs
         WHERE enabled = 1 AND (next_run_at IS NULL OR datetime(next_run_at) <= datetime('now'))
         ORDER BY next_run_at ASC`
      )
      .all() as MonitorJob[]
  }

  updateNextRun(id: number, nextRunAt: string): void {
    this.db
      .prepare("UPDATE monitor_jobs SET next_run_at = ?, updated_at = datetime('now') WHERE id = ?")
      .run(nextRunAt, id)
  }

  toggleEnabled(id: number, enabled: boolean): void {
    this.db
      .prepare(
        "UPDATE monitor_jobs SET enabled = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .run(enabled ? 1 : 0, id)
  }

  updateInterval(id: number, intervalMinutes: number): void {
    this.db
      .prepare(
        "UPDATE monitor_jobs SET interval_minutes = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .run(intervalMinutes, id)
  }

  deleteByCompetitorId(competitorId: number): void {
    this.db.prepare('DELETE FROM monitor_jobs WHERE competitor_id = ?').run(competitorId)
  }
}
