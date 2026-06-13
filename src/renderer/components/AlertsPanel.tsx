import { useState, useEffect, useCallback } from 'react'
import { useT } from '../i18n'
import type { AlertItem } from '../../shared/ipc'

function formatTime(iso: string, t: (k: string, ...a: string[]) => string): string {
  const d = new Date(iso)
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return t('list.justNow')
  if (diffMin < 60) return t('list.minAgo', String(diffMin))
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return t('list.hourAgo', String(diffH))
  return d.toLocaleDateString()
}

export function AlertsPanel(): JSX.Element {
  const t = useT()
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { window.api.alertsList().then(setAlerts).finally(() => setLoading(false)) }, [])

  const handleMarkRead = useCallback(async (id: number) => {
    await window.api.alertsMarkRead(id)
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: 1 } : a)))
  }, [])

  const handleMarkAllRead = useCallback(async () => {
    await window.api.alertsMarkAllRead()
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: 1 })))
  }, [])

  const unreadCount = alerts.filter((a) => !a.isRead).length

  if (loading) return <div className="card" style={{ marginBottom: 16 }}><div className="card-body"><div className="loading-pulse" /></div></div>

  if (alerts.length === 0) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <div className="empty-state-icon">&#128276;</div>
            <div className="empty-state-title">{t('alerts.empty')}</div>
            <div className="empty-state-desc">{t('alerts.emptyDesc')}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <span className="card-title">
          {t('alerts.title')} {unreadCount > 0 && <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 100, padding: '1px 7px', fontSize: 11, fontWeight: 600, marginLeft: 4 }}>{unreadCount}</span>}
        </span>
        {unreadCount > 0 && <button className="btn btn-ghost" onClick={handleMarkAllRead} style={{ fontSize: 12 }}>{t('alerts.markAllRead')}</button>}
      </div>
      <div className="card-body-flush">
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('alerts.colType')}</th><th>{t('alerts.colProduct')}</th><th>{t('alerts.colMessage')}</th><th>{t('alerts.colTime')}</th><th></th></tr></thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} style={{ fontWeight: a.isRead ? 400 : 600 }}>
                  <td><span className={`badge ${a.isRead ? 'badge-paused' : 'badge-active'}`}>{t(`alerts.types.${a.alertType}` as Parameters<typeof t>[0])}</span></td>
                  <td className="cell-asin">{a.competitorAsin}</td>
                  <td style={{ fontSize: 13, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.message}</td>
                  <td className="cell-time">{formatTime(a.createdAt, t)}</td>
                  <td>{!a.isRead && <button className="btn btn-ghost" onClick={() => handleMarkRead(a.id)} style={{ fontSize: 11 }}>{t('alerts.read')}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
