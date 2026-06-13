import { useState, useEffect, useCallback } from 'react'
import { useT } from '../i18n'
import type { CompetitorDetail as CompetitorDetailType } from '../../shared/ipc'
import { TrendChart } from './TrendChart'
import { ManualCapture } from './ManualCapture'

interface Props { competitorId: number; onBack: () => void }

export function CompetitorDetail({ competitorId, onBack }: Props): JSX.Element {
  const t = useT()
  const [data, setData] = useState<CompetitorDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadDetail = useCallback(async () => {
    try { setData(await window.api.competitorsGet(competitorId)) }
    finally { setLoading(false) }
  }, [competitorId])

  useEffect(() => { loadDetail() }, [loadDetail])

  const handleRefresh = useCallback(async () => {
    if (!data) return
    setRefreshing(true)
    try { await window.api.captureRun({ input: data.url }); await loadDetail() }
    finally { setRefreshing(false) }
  }, [data, loadDetail])

  const handleExport = useCallback(async () => {
    if (!data) return
    try { await window.api.exportSingle(data.id) } catch { /* cancelled */ }
  }, [data])

  const handleIntervalChange = useCallback(async (minutes: number) => {
    if (!data) return
    await window.api.competitorsUpdateInterval(data.id, minutes)
  }, [data])

  if (loading) {
    return <div className="card"><div className="card-body"><div className="loading-pulse" /></div></div>
  }

  if (!data) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-state-title">{t('detail.notFound')}</div>
            <button className="btn btn-secondary" onClick={onBack} style={{ marginTop: 16 }}>{t('detail.backToDashboard')}</button>
          </div>
        </div>
      </div>
    )
  }

  const statusCls = data.status === 'active' ? 'badge-active' : data.status === 'error' ? 'badge-error' : 'badge-paused'
  const statusLabel = t(`status.${data.status}` as Parameters<typeof t>[0])

  return (
    <>
      <div className="detail-bar">
        <button className="btn-back" onClick={onBack}>&#8592; {t('detail.back')}</button>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('detail.title')}</span>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="detail-header">
          {data.imageUrl && <img className="detail-image" src={data.imageUrl} alt={data.title || 'Product'} />}
          <div className="detail-meta">
            <div className="detail-title">{data.title || t('detail.untitled')}</div>
            <div className="detail-subtitle">
              <strong>{data.asin}</strong> · amazon.{data.marketplace.toLowerCase()} ·{' '}
              <span className={`badge ${statusCls}`}>{statusLabel}</span>
              {data.consecutiveFailures > 0 && (
                <span style={{ color: 'var(--status-error)', marginLeft: 8 }}>
                  {t('detail.failures', String(data.consecutiveFailures))}
                </span>
              )}
            </div>
            <div className="detail-subtitle">
              <a href={data.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: 12 }}>
                {t('detail.viewOnAmazon')} &#8599;
              </a>
            </div>
          </div>
          <div className="detail-actions">
            <button className="btn btn-primary" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <><span className="spinner" /> {t('detail.refreshing')}</> : <>&#8635; {t('detail.refresh')}</>}
            </button>
            <button className="btn btn-secondary" onClick={handleExport}>&#8615; {t('detail.exportCSV')}</button>
            <select className="input" style={{ width: 100, padding: '4px 8px', fontSize: 12 }} onChange={(e) => handleIntervalChange(Number(e.target.value))} defaultValue="360">
              <option value="360">{t('detail.every6h')}</option>
              <option value="1440">{t('detail.daily')}</option>
            </select>
          </div>
        </div>
      </div>

      {(data.status === 'error' || data.status === 'paused') && (
        <ManualCapture competitor={data} onSaved={loadDetail} />
      )}

      <TrendChart snapshots={data.snapshots} />

      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('detail.snapshotHistory')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{data.snapshots.length}</span></span>
        </div>
        <div className="card-body-flush">
          {data.snapshots.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">{t('detail.noSnapshots')}</div>
              <div className="empty-state-desc">{t('detail.noSnapshotsDesc')}</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('detail.colTime')}</th><th>{t('detail.colPrice')}</th><th>{t('detail.colRating')}</th>
                    <th>{t('detail.colReviews')}</th><th>{t('detail.colAvailability')}</th><th>{t('detail.colStatus')}</th><th>{t('detail.colError')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.snapshots.map((s) => (
                    <tr key={s.id}>
                      <td className="cell-time">{new Date(s.capturedAt).toLocaleString()}</td>
                      <td className="cell-price">{s.price != null ? `$${s.price.toFixed(2)}` : '—'}</td>
                      <td className="cell-rating">{s.rating != null ? `${s.rating}★` : '—'}</td>
                      <td className="cell-num">{s.reviewCount != null ? s.reviewCount.toLocaleString() : '—'}</td>
                      <td style={{ fontSize: 12 }}>{s.availability || '—'}</td>
                      <td><span className={s.captureStatus === 'success' ? 'snap-success' : 'snap-failed'}><span className={`status-dot ${s.captureStatus === 'success' ? 'status-dot-success' : 'status-dot-failed'}`} />{t(`detail.${s.captureStatus}` as Parameters<typeof t>[0])}</span></td>
                      <td className="cell-error" title={s.errorMessage || undefined}>{s.errorType || '—'}</td>
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
