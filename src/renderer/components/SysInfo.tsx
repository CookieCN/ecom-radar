import { useState, useEffect } from 'react'
import { useT, useLang } from '../i18n'
import type { HealthCheckResult, DbHealthCheckResult } from '../../shared/ipc'

export function SysInfo(): JSX.Element {
  const t = useT()
  const { lang, setLang } = useLang()
  const [health, setHealth] = useState<HealthCheckResult | null>(null)
  const [dbHealth, setDbHealth] = useState<DbHealthCheckResult | null>(null)
  const [schedState, setSchedState] = useState<string>('unknown')

  useEffect(() => {
    if (!window.api) return
    window.api.healthCheck().then(setHealth).catch(() => {})
    window.api.dbHealthCheck().then(setDbHealth).catch(() => {})
    window.api.schedulerStatus().then((s) => setSchedState(s.state)).catch(() => {})
  }, [])

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">{t('sysinfo.systemInfo')}</span></div>
        <div className="card-body">
          {!health && <div className="loading-pulse" />}
          {health && (
            <div className="sys-grid">
              <div className="sys-item"><div className="sys-item-label">{t('sysinfo.electron')}</div><div className="sys-item-value">{health.electronVersion}</div></div>
              <div className="sys-item"><div className="sys-item-label">{t('sysinfo.nodejs')}</div><div className="sys-item-value">{health.nodeVersion}</div></div>
              <div className="sys-item"><div className="sys-item-label">{t('sysinfo.platform')}</div><div className="sys-item-value">{health.platform}</div></div>
              <div className="sys-item"><div className="sys-item-label">{t('sysinfo.status')}</div><div className="sys-item-value"><span className="badge badge-active">OK</span></div></div>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">{t('sysinfo.database')}</span></div>
        <div className="card-body">
          {!dbHealth && <div className="loading-pulse" />}
          {dbHealth && (
            <>
              <div className="sys-grid" style={{ marginBottom: 16 }}>
                <div className="sys-item"><div className="sys-item-label">{t('sysinfo.migrationVersion')}</div><div className="sys-item-value">{dbHealth.migrationVersion}</div></div>
                <div className="sys-item"><div className="sys-item-label">{t('sysinfo.dbPath')}</div><div className="sys-item-value" style={{ fontSize: 11, wordBreak: 'break-all' }}>{dbHealth.dbPath}</div></div>
              </div>
              <div className="sys-grid">
                {Object.entries(dbHealth.tableCounts).map(([table, count]) => (
                  <div className="sys-item" key={table}><div className="sys-item-label">{table}</div><div className="sys-item-value">{t('sysinfo.rows', String(count))}</div></div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">{t('sysinfo.scheduler')}</span></div>
        <div className="card-body">
          <div className="sys-grid" style={{ marginBottom: 12 }}>
            <div className="sys-item"><div className="sys-item-label">{t('sysinfo.state')}</div>
              <div className="sys-item-value"><span className={`badge ${schedState === 'running' ? 'badge-active' : 'badge-paused'}`}>{schedState}</span></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => window.api.schedulerStart()}>{t('sysinfo.start')}</button>
            <button className="btn btn-secondary" onClick={() => window.api.schedulerStop()}>{t('sysinfo.stop')}</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">{t('sysinfo.language')}</span></div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn ${lang === 'en' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLang('en')}>English</button>
            <button className={`btn ${lang === 'zh-CN' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLang('zh-CN')}>中文</button>
          </div>
        </div>
      </div>
    </>
  )
}
