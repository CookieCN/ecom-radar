import Database from 'better-sqlite3'
import { SettingsRepository } from '../data/repositories/settings'
import type { NavigationAccessGuard } from '../capture/browser'

export const DEFAULT_DAILY_PAGE_BUDGET = 80
export const MAX_DAILY_PAGE_BUDGET = 100
export const PAGE_BUDGET_SETTING = 'monitor.dailyPageBudget'
const RISK_ERRORS = new Set(['CAPTCHA_DETECTED', 'BOT_CHECK_DETECTED', 'HTTP_429', 'HTTP_503'])

export interface PageBudgetStatus {
  limit: number
  used: number
  remaining: number
  deferred: number
  cooldowns: Array<{ marketplace: string; reason: string; endsAt: string }>
}

export function createNavigationAccessGuard(
  service: PageBudgetService,
  marketplace: string,
  sourceType: string,
  sourceId?: number
): NavigationAccessGuard {
  return {
    reserve: (pageType) => service.reserve(marketplace, pageType, sourceType, sourceId),
    complete: (logId, result, errorType) => {
      service.complete(logId, result, errorType ?? null)
      if (errorType) service.registerRisk(marketplace, errorType)
    }
  }
}

export class PageBudgetService {
  constructor(private db: Database.Database) {}

  getLimit(): number {
    const value = new SettingsRepository(this.db).getNumber(
      PAGE_BUDGET_SETTING,
      DEFAULT_DAILY_PAGE_BUDGET
    )
    return Math.min(MAX_DAILY_PAGE_BUDGET, Math.max(1, Math.floor(value)))
  }

  setLimit(value: number): number {
    if (!Number.isInteger(value) || value < 1 || value > MAX_DAILY_PAGE_BUDGET) {
      throw new Error(`Daily page budget must be between 1 and ${MAX_DAILY_PAGE_BUDGET}.`)
    }
    new SettingsRepository(this.db).setNumber(PAGE_BUDGET_SETTING, value)
    return value
  }

  getUsed(date = new Date()): number {
    const day = this.localDateKey(date)
    const row = this.db
      .prepare(
        "SELECT COUNT(*) count FROM page_access_log WHERE date(accessed_at, 'localtime') = ?"
      )
      .get(day) as { count: number }
    return row.count
  }

  reserve(
    marketplace: string,
    pageType: string,
    sourceType: string,
    sourceId?: number
  ): { allowed: true; logId: number } | { allowed: false; reason: 'budget' | 'cooldown' } {
    if (this.getCooldown(marketplace)) return { allowed: false, reason: 'cooldown' }
    if (this.getUsed() >= this.getLimit()) return { allowed: false, reason: 'budget' }
    const result = this.db
      .prepare(
        `INSERT INTO page_access_log (marketplace, page_type, source_type, source_id)
         VALUES (?, ?, ?, ?)`
      )
      .run(marketplace, pageType, sourceType, sourceId ?? null)
    return { allowed: true, logId: Number(result.lastInsertRowid) }
  }

  complete(logId: number, result: string, errorType: string | null = null): void {
    this.db
      .prepare('UPDATE page_access_log SET result=?, error_type=? WHERE id=?')
      .run(result, errorType, logId)
  }

  registerRisk(marketplace: string, errorType: string): void {
    if (!RISK_ERRORS.has(errorType)) return
    const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    this.db
      .prepare(
        `INSERT INTO marketplace_cooldowns (marketplace, reason, started_at, ends_at)
         VALUES (?, ?, datetime('now'), ?)
         ON CONFLICT(marketplace) DO UPDATE SET reason=excluded.reason,
           started_at=datetime('now'), ends_at=excluded.ends_at`
      )
      .run(marketplace, errorType, endsAt)
  }

  getCooldown(marketplace: string): { reason: string; ends_at: string } | undefined {
    this.db
      .prepare("DELETE FROM marketplace_cooldowns WHERE datetime(ends_at) <= datetime('now')")
      .run()
    return this.db
      .prepare(
        "SELECT reason, ends_at FROM marketplace_cooldowns WHERE marketplace=? AND datetime(ends_at) > datetime('now')"
      )
      .get(marketplace) as { reason: string; ends_at: string } | undefined
  }

  status(): PageBudgetStatus {
    const limit = this.getLimit()
    const used = this.getUsed()
    const deferred = (
      this.db
        .prepare('SELECT COUNT(*) count FROM seller_store_jobs WHERE deferred_reason IS NOT NULL')
        .get() as { count: number }
    ).count
    const cooldowns = this.db
      .prepare(
        "SELECT marketplace, reason, ends_at FROM marketplace_cooldowns WHERE datetime(ends_at) > datetime('now') ORDER BY ends_at"
      )
      .all() as Array<{ marketplace: string; reason: string; ends_at: string }>
    return {
      limit,
      used,
      remaining: Math.max(0, limit - used),
      deferred,
      cooldowns: cooldowns.map((row) => ({
        marketplace: row.marketplace,
        reason: row.reason,
        endsAt: row.ends_at
      }))
    }
  }

  private localDateKey(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}
