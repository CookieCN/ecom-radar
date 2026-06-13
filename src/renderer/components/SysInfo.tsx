import { useState, useEffect } from 'react'
import type { HealthCheckResult, DbHealthCheckResult } from '../../shared/ipc'

export function SysInfo(): JSX.Element {
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
        <div className="card-header">
          <span className="card-title">System Info</span>
        </div>
        <div className="card-body">
          {!health && <div className="loading-pulse" />}
          {health && (
            <div className="sys-grid">
              <div className="sys-item">
                <div className="sys-item-label">Electron</div>
                <div className="sys-item-value">{health.electronVersion}</div>
              </div>
              <div className="sys-item">
                <div className="sys-item-label">Node.js</div>
                <div className="sys-item-value">{health.nodeVersion}</div>
              </div>
              <div className="sys-item">
                <div className="sys-item-label">Platform</div>
                <div className="sys-item-value">{health.platform}</div>
              </div>
              <div className="sys-item">
                <div className="sys-item-label">Status</div>
                <div className="sys-item-value">
                  <span className="badge badge-active">OK</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Database</span>
        </div>
        <div className="card-body">
          {!dbHealth && <div className="loading-pulse" />}
          {dbHealth && (
            <>
              <div className="sys-grid" style={{ marginBottom: 16 }}>
                <div className="sys-item">
                  <div className="sys-item-label">Migration Version</div>
                  <div className="sys-item-value">{dbHealth.migrationVersion}</div>
                </div>
                <div className="sys-item">
                  <div className="sys-item-label">DB Path</div>
                  <div className="sys-item-value" style={{ fontSize: 11, wordBreak: 'break-all' }}>
                    {dbHealth.dbPath}
                  </div>
                </div>
              </div>
              <div className="sys-grid">
                {Object.entries(dbHealth.tableCounts).map(([table, count]) => (
                  <div className="sys-item" key={table}>
                    <div className="sys-item-label">{table}</div>
                    <div className="sys-item-value">{count} rows</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Scheduler</span>
        </div>
        <div className="card-body">
          <div className="sys-grid" style={{ marginBottom: 12 }}>
            <div className="sys-item">
              <div className="sys-item-label">State</div>
              <div className="sys-item-value">
                <span className={`badge ${schedState === 'running' ? 'badge-active' : 'badge-paused'}`}>
                  {schedState}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => window.api.schedulerStart()}>
              Start
            </button>
            <button className="btn btn-secondary" onClick={() => window.api.schedulerStop()}>
              Stop
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
