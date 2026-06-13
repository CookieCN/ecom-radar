import { useState, useEffect, useCallback } from 'react'
import { useT } from '../i18n'
import type { CompetitorListItem } from '../../shared/ipc'

interface Props {
  onViewDetail: (id: number) => void
  onRefresh: () => void
}

function formatTime(iso: string | null, t: (k: string, ...a: string[]) => string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
  if (diffMin < 1) return t('list.justNow')
  if (diffMin < 60) return t('list.minAgo', String(diffMin))
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return t('list.hourAgo', String(diffH))
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return t('list.dayAgo', String(diffD))
  return d.toLocaleDateString()
}

export function CompetitorList({ onViewDetail, onRefresh }: Props): JSX.Element {
  const t = useT()
  const [items, setItems] = useState<CompetitorListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingId, setRefreshingId] = useState<number | null>(null)

  const loadList = useCallback(async () => {
    try {
      const list = await window.api.competitorsList()
      setItems(list)
    } catch { /* DB may not be ready */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadList() }, [loadList])

  const handleRefresh = useCallback(async (item: CompetitorListItem) => {
    setRefreshingId(item.id)
    try { await window.api.captureRun({ input: item.url }); onRefresh() }
    catch { /* ignore */ }
    finally { setRefreshingId(null) }
  }, [onRefresh])

  const handleDelete = useCallback(async (item: CompetitorListItem) => {
    if (!confirm(`Delete ${item.title || item.asin}?`)) return
    await window.api.competitorsDelete(item.id)
    onRefresh()
  }, [onRefresh])

  const handleToggleStatus = useCallback(async (item: CompetitorListItem) => {
    await window.api.competitorsToggleStatus(item.id)
    onRefresh()
  }, [onRefresh])

  const handleExportAll = useCallback(async () => {
    try { await window.api.exportAll() } catch { /* cancelled */ }
  }, [])

  if (loading) {
    return <div className="card"><div className="card-body"><div className="loading-pulse" /></div></div>
  }

  if (items.length === 0) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-state-icon">&#128269;</div>
            <div className="empty-state-title">{t('list.empty')}</div>
            <div className="empty-state-desc">{t('list.emptyDesc')}</div>
          </div>
        </div>
      </div>
    )
  }

  const statusClass = (s: string) =>
    s === 'active' ? 'badge-active' : s === 'error' ? 'badge-error' : 'badge-paused'

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          {t('list.title')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{items.length}</span>
        </span>
        <button className="btn btn-secondary" onClick={handleExportAll} style={{ fontSize: 12 }}>
          &#8615; {t('list.exportAll')}
        </button>
      </div>
      <div className="card-body-flush">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('list.colProduct')}</th>
                <th>{t('list.colAsin')}</th>
                <th>{t('list.colMarket')}</th>
                <th>{t('list.colPrice')}</th>
                <th>{t('list.colRating')}</th>
                <th>{t('list.colStatus')}</th>
                <th>{t('list.colCaptured')}</th>
                <th>{t('list.colSnaps')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="cell-title" title={item.title || undefined}>
                    {item.title || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('list.untitled')}</span>}
                  </td>
                  <td><span className="cell-asin" onClick={() => window.open(item.url, '_blank')}>{item.asin}</span></td>
                  <td className="cell-marketplace">{item.marketplace}</td>
                  <td className="cell-price">{item.latestPrice != null ? `$${item.latestPrice.toFixed(2)}` : '—'}</td>
                  <td className="cell-rating">
                    {item.latestRating ? `${item.latestRating}★` : '—'}
                    {item.latestReviewCount != null && <span className="cell-num"> ({item.latestReviewCount.toLocaleString()})</span>}
                  </td>
                  <td><span className={`badge ${statusClass(item.status)}`}>{t(`status.${item.status}` as Parameters<typeof t>[0])}</span></td>
                  <td className="cell-time">
                    {item.status === 'error' && item.consecutiveFailures > 0
                      ? t('list.failures', String(item.consecutiveFailures))
                      : formatTime(item.lastCapturedAt, t)}
                  </td>
                  <td className="cell-num">{item.snapshotCount}</td>
                  <td>
                    <div className="cell-actions">
                      <button className="btn btn-ghost" onClick={() => onViewDetail(item.id)}>&#9654;</button>
                      <button className="btn btn-ghost" onClick={() => handleRefresh(item)} disabled={refreshingId === item.id}>
                        {refreshingId === item.id ? <span className="spinner" /> : <>&#8635;</>}
                      </button>
                      <button className="btn btn-ghost" onClick={() => handleToggleStatus(item)}>
                        {item.status === 'paused' ? <>&#9654;</> : <>&#9646;&#9646;</>}
                      </button>
                      <button className="btn btn-danger" onClick={() => handleDelete(item)}>&#10005;</button>
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
