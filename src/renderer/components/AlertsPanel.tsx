import { useState, useEffect, useCallback } from 'react'
import type { AlertItem } from '../../shared/ipc'

const ALERT_TYPE_LABELS: Record<string, string> = {
  price_change: 'Price',
  rating_drop: 'Rating',
  review_growth: 'Reviews',
  availability_change: 'Availability'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  return d.toLocaleDateString()
}

export function AlertsPanel(): JSX.Element {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadAlerts = useCallback(async () => {
    try {
      const list = await window.api.alertsList()
      setAlerts(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  const handleMarkRead = useCallback(async (id: number) => {
    await window.api.alertsMarkRead(id)
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: 1 } : a)))
  }, [])

  const handleMarkAllRead = useCallback(async () => {
    await window.api.alertsMarkAllRead()
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: 1 })))
  }, [])

  const unreadCount = alerts.filter((a) => !a.isRead).length

  if (loading) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="loading-pulse" />
        </div>
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <div className="empty-state-icon">&#128276;</div>
            <div className="empty-state-title">No alerts</div>
            <div className="empty-state-desc">
              Alerts will appear when prices change, ratings drop, reviews grow, or availability changes.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <span className="card-title">
          Alerts{' '}
          {unreadCount > 0 && (
            <span
              style={{
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 100,
                padding: '1px 7px',
                fontSize: 11,
                fontWeight: 600,
                marginLeft: 4
              }}
            >
              {unreadCount}
            </span>
          )}
        </span>
        {unreadCount > 0 && (
          <button className="btn btn-ghost" onClick={handleMarkAllRead} style={{ fontSize: 12 }}>
            Mark all read
          </button>
        )}
      </div>
      <div className="card-body-flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Product</th>
                <th>Message</th>
                <th>Time</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} style={{ fontWeight: a.isRead ? 400 : 600 }}>
                  <td>
                    <span
                      className={`badge ${
                        a.isRead ? 'badge-paused' : 'badge-active'
                      }`}
                    >
                      {ALERT_TYPE_LABELS[a.alertType] || a.alertType}
                    </span>
                  </td>
                  <td className="cell-asin">{a.competitorAsin}</td>
                  <td style={{ fontSize: 13, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.message}
                  </td>
                  <td className="cell-time">{formatTime(a.createdAt)}</td>
                  <td>
                    {!a.isRead && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => handleMarkRead(a.id)}
                        style={{ fontSize: 11 }}
                      >
                        Read
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
