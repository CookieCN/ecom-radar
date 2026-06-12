// ============================================================
// Alert rule engine
// Compares new snapshot to previous and generates alerts.
// ============================================================

import type { Snapshot, NewAlert } from '../data/types'
import { getDatabase } from '../data'
import { AlertsRepository } from '../data/repositories/alerts'
import { SnapshotsRepository } from '../data/repositories/snapshots'

const PRICE_CHANGE_THRESHOLD_PCT = 5 // alert if price changes by >= 5%
const RATING_DROP_THRESHOLD = 0.3 // alert if rating drops by >= 0.3 stars
const REVIEW_GROWTH_THRESHOLD = 10 // alert if review count grows by >= 10
const DEDUP_WINDOW_DAYS = 1 // don't fire same alert type for same competitor within 1 day

/**
 * Run alert rules for a newly captured snapshot.
 * Returns the generated alerts (if any).
 */
export function runAlertRules(competitorId: number, newSnapshot: Snapshot): NewAlert[] {
  const db = getDatabase()
  const alertsRepo = new AlertsRepository(db)
  const snapshotsRepo = new SnapshotsRepository(db)

  // Find the previous successful snapshot
  const previous = snapshotsRepo.findPrevious(competitorId, newSnapshot.id)
  if (!previous) return [] // first snapshot — nothing to compare

  const alerts: NewAlert[] = []

  // Price change
  if (
    previous.price !== null &&
    newSnapshot.price !== null &&
    previous.price !== 0
  ) {
    const pctChange = Math.abs((newSnapshot.price - previous.price) / previous.price) * 100
    if (pctChange >= PRICE_CHANGE_THRESHOLD_PCT) {
      const direction = newSnapshot.price > previous.price ? 'increased' : 'dropped'
      alerts.push({
        competitor_id: competitorId,
        snapshot_id: newSnapshot.id,
        previous_snapshot_id: previous.id,
        alert_type: 'price_change',
        title: `Price ${direction}`,
        message: `Price ${direction} from $${previous.price.toFixed(2)} to $${newSnapshot.price.toFixed(2)} (${pctChange.toFixed(0)}%)`,
        is_read: 0
      })
    }
  }

  // Rating drop (only alert on drops, not increases)
  if (previous.rating !== null && newSnapshot.rating !== null) {
    const drop = previous.rating - newSnapshot.rating
    if (drop >= RATING_DROP_THRESHOLD) {
      alerts.push({
        competitor_id: competitorId,
        snapshot_id: newSnapshot.id,
        previous_snapshot_id: previous.id,
        alert_type: 'rating_drop',
        title: 'Rating dropped',
        message: `Rating dropped from ${previous.rating}★ to ${newSnapshot.rating}★ (-${drop.toFixed(1)})`,
        is_read: 0
      })
    }
  }

  // Review growth
  if (previous.review_count !== null && newSnapshot.review_count !== null) {
    const growth = newSnapshot.review_count - previous.review_count
    if (growth >= REVIEW_GROWTH_THRESHOLD) {
      alerts.push({
        competitor_id: competitorId,
        snapshot_id: newSnapshot.id,
        previous_snapshot_id: previous.id,
        alert_type: 'review_growth',
        title: 'Reviews growing',
        message: `Review count grew from ${previous.review_count.toLocaleString()} to ${newSnapshot.review_count.toLocaleString()} (+${growth.toLocaleString()})`,
        is_read: 0
      })
    }
  }

  // Availability change
  if (
    previous.availability &&
    newSnapshot.availability &&
    previous.availability !== newSnapshot.availability
  ) {
    alerts.push({
      competitor_id: competitorId,
      snapshot_id: newSnapshot.id,
      previous_snapshot_id: previous.id,
      alert_type: 'availability_change',
      title: 'Availability changed',
      message: `Availability changed from "${previous.availability}" to "${newSnapshot.availability}"`,
      is_read: 0
    })
  }

  // Dedup — don't fire same alert type within dedup window
  const recentAlerts = alertsRepo.findByCompetitorId(competitorId, 20)
  const deduped = alerts.filter((a) => !isDuplicate(a, recentAlerts))

  // Save alerts
  for (const alert of deduped) {
    alertsRepo.create(alert)
  }

  return deduped
}

function isDuplicate(alert: NewAlert, recentAlerts: { alert_type: string; created_at: string }[]): boolean {
  const windowStart = Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000
  return recentAlerts.some(
    (r) =>
      r.alert_type === alert.alert_type &&
      new Date(r.created_at).getTime() > windowStart
  )
}
