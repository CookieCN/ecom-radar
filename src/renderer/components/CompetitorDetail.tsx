import { useState, useEffect, useCallback } from 'react'
import type { CompetitorDetail as CompetitorDetailType } from '../../shared/ipc'
import { TrendChart } from './TrendChart'
import { ManualCapture } from './ManualCapture'

interface Props {
  competitorId: number
  onBack: () => void
}

function statusBadge(status: string): JSX.Element {
  const map: Record<string, { cls: string; label: string }> = {
    active: { cls: 'badge-active', label: 'Active' },
    paused: { cls: 'badge-paused', label: 'Paused' },
    error: { cls: 'badge-error', label: 'Error' }
  }
  const s = map[status] ?? { cls: 'badge-paused', label: status }
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString()
}

export function CompetitorDetail({ competitorId, onBack }: Props): JSX.Element {
  const [data, setData] = useState<CompetitorDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadDetail = useCallback(async () => {
    try {
      const detail = await window.api.competitorsGet(competitorId)
      setData(detail)
    } finally {
      setLoading(false)
    }
  }, [competitorId])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  const handleIntervalChange = useCallback(
    async (intervalMinutes: number) => {
      if (!data) return
      await window.api.competitorsUpdateInterval(data.id, intervalMinutes)
    },
    [data]
  )

  const handleExport = useCallback(async () => {
    if (!data) return
    try {
      await window.api.exportSingle(data.id)
    } catch {
      // user cancelled or error
    }
  }, [data])

  const handleRefresh = useCallback(async () => {
    if (!data) return
    setRefreshing(true)
    try {
      await window.api.captureRun({ input: data.url })
      await loadDetail()
    } finally {
      setRefreshing(false)
    }
  }, [data, loadDetail])

  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="loading-pulse" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-state-title">Competitor not found</div>
            <button className="btn btn-secondary" onClick={onBack} style={{ marginTop: 16 }}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="detail-bar">
        <button className="btn-back" onClick={onBack}>
          &#8592; Back
        </button>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Competitor Detail
        </span>
      </div>

      {/* Product Header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="detail-header">
          {data.imageUrl && (
            <img className="detail-image" src={data.imageUrl} alt={data.title || 'Product'} />
          )}
          <div className="detail-meta">
            <div className="detail-title">{data.title || 'Untitled Product'}</div>
            <div className="detail-subtitle">
              <strong>{data.asin}</strong> &middot; amazon.{data.marketplace.toLowerCase()} &middot;{' '}
              {statusBadge(data.status)}
              {data.consecutiveFailures > 0 && (
                <span style={{ color: 'var(--status-error)', marginLeft: 8 }}>
                  {data.consecutiveFailures} consecutive failure{data.consecutiveFailures > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="detail-subtitle">
              <a
                href={data.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent)', fontSize: 12 }}
              >
                View on Amazon &#8599;
              </a>
            </div>
          </div>
          <div className="detail-actions">
            <button
              className="btn btn-primary"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <span className="spinner" /> Refreshing…
                </>
              ) : (
                <>&#8635; Refresh</>
              )}
            </button>
            <button className="btn btn-secondary" onClick={handleExport}>
              &#8615; Export CSV
            </button>
            <select
              className="input"
              style={{
                width: 90,
                padding: '4px 8px',
                fontSize: 12,
                fontFamily: 'var(--font-sans)'
              }}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              defaultValue="360"
            >
              <option value="360">Every 6h</option>
              <option value="1440">Daily</option>
            </select>
          </div>
        </div>
      </div>

      {/* Manual capture fallback — show when auto-capture is failing */}
      {(data.status === 'error' || data.status === 'paused') && (
        <ManualCapture competitor={data} onSaved={loadDetail} />
      )}

      {/* Trend Charts */}
      <TrendChart snapshots={data.snapshots} />

      {/* Snapshot History */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Snapshot History{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
              {data.snapshots.length}
            </span>
          </span>
        </div>
        <div className="card-body-flush">
          {data.snapshots.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No snapshots yet</div>
              <div className="empty-state-desc">
                Click Refresh to capture the product page for the first time.
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Price</th>
                    <th>Rating</th>
                    <th>Reviews</th>
                    <th>Availability</th>
                    <th>Status</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {data.snapshots.map((s) => (
                    <tr key={s.id}>
                      <td className="cell-time">{formatDateTime(s.capturedAt)}</td>
                      <td className="cell-price">
                        {s.price != null ? `$${s.price.toFixed(2)}` : '—'}
                      </td>
                      <td className="cell-rating">
                        {s.rating != null ? `${s.rating}★` : '—'}
                      </td>
                      <td className="cell-num">
                        {s.reviewCount != null ? s.reviewCount.toLocaleString() : '—'}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {s.availability || '—'}
                      </td>
                      <td>
                        <span
                          className={
                            s.captureStatus === 'success' ? 'snap-success' : 'snap-failed'
                          }
                        >
                          <span
                            className={`status-dot ${
                              s.captureStatus === 'success'
                                ? 'status-dot-success'
                                : 'status-dot-failed'
                            }`}
                          />
                          {s.captureStatus}
                        </span>
                      </td>
                      <td className="cell-error" title={s.errorMessage || undefined}>
                        {s.errorType || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
