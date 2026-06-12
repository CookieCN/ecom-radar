import { useState, useEffect, useCallback } from 'react'
import type { CompetitorListItem } from '../../shared/ipc'

interface Props {
  onViewDetail: (id: number) => void
  onRefresh: () => void
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

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d ago`
  return d.toLocaleDateString()
}

function formatPrice(price: number | null): string {
  if (price == null) return '—'
  return `$${price.toFixed(2)}`
}

function formatRating(rating: number | null): string {
  if (rating == null) return '—'
  return `${rating}★`
}

export function CompetitorList({ onViewDetail, onRefresh }: Props): JSX.Element {
  const [items, setItems] = useState<CompetitorListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingId, setRefreshingId] = useState<number | null>(null)

  const loadList = useCallback(async () => {
    try {
      const list = await window.api.competitorsList()
      setItems(list)
    } catch {
      // silently fail — DB may not be ready
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  const handleRefresh = useCallback(
    async (item: CompetitorListItem) => {
      setRefreshingId(item.id)
      try {
        await window.api.captureRun({ input: item.url })
        onRefresh()
      } catch {
        // ignore
      } finally {
        setRefreshingId(null)
      }
    },
    [onRefresh]
  )

  const handleDelete = useCallback(
    async (item: CompetitorListItem) => {
      if (!confirm(`Delete ${item.title || item.asin} and all its snapshots?`)) return
      await window.api.competitorsDelete(item.id)
      onRefresh()
    },
    [onRefresh]
  )

  const handleExportAll = useCallback(async () => {
    try {
      await window.api.exportAll()
    } catch {
      // user cancelled or error
    }
  }, [])

  const handleToggleStatus = useCallback(
    async (item: CompetitorListItem) => {
      await window.api.competitorsToggleStatus(item.id)
      onRefresh()
    },
    [onRefresh]
  )

  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="loading-pulse" />
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-state-icon">&#128269;</div>
            <div className="empty-state-title">No competitors yet</div>
            <div className="empty-state-desc">
              Add your first Amazon product URL or ASIN above to start monitoring.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          Competitors <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{items.length}</span>
        </span>
        <button className="btn btn-secondary" onClick={handleExportAll} style={{ fontSize: 12 }}>
          &#8615; Export All CSV
        </button>
      </div>
      <div className="card-body-flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>ASIN</th>
                <th>Market</th>
                <th>Price</th>
                <th>Rating</th>
                <th>Status</th>
                <th>Captured</th>
                <th>Snaps</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="cell-title" title={item.title || undefined}>
                    {item.title || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Untitled</span>}
                  </td>
                  <td>
                    <span
                      className="cell-asin"
                      title={`Open on Amazon: ${item.url}`}
                      onClick={() => {
                        // Electron will open external URLs
                        window.open(item.url, '_blank')
                      }}
                    >
                      {item.asin}
                    </span>
                  </td>
                  <td className="cell-marketplace">{item.marketplace}</td>
                  <td className="cell-price">{formatPrice(item.latestPrice)}</td>
                  <td className="cell-rating">
                    {item.latestRating ? formatRating(item.latestRating) : '—'}
                    {item.latestReviewCount != null && (
                      <span className="cell-num"> ({item.latestReviewCount.toLocaleString()})</span>
                    )}
                  </td>
                  <td>{statusBadge(item.status)}</td>
                  <td className="cell-time" title={item.lastCapturedAt || undefined}>
                    {item.status === 'error' && item.consecutiveFailures > 0
                      ? `${item.consecutiveFailures} failures`
                      : formatTime(item.lastCapturedAt)}
                  </td>
                  <td className="cell-num">{item.snapshotCount}</td>
                  <td>
                    <div className="cell-actions">
                      <button
                        className="btn btn-ghost"
                        onClick={() => onViewDetail(item.id)}
                        title="View detail"
                      >
                        &#9654;
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => handleRefresh(item)}
                        disabled={refreshingId === item.id}
                        title="Refresh now"
                      >
                        {refreshingId === item.id ? (
                          <span className="spinner" />
                        ) : (
                          <>&#8635;</>
                        )}
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => handleToggleStatus(item)}
                        title={item.status === 'paused' ? 'Resume' : 'Pause'}
                      >
                        {item.status === 'paused' ? <>&#9654;</> : <>&#9646;&#9646;</>}
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(item)}
                        title="Delete"
                      >
                        &#10005;
                      </button>
                    </div>
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
