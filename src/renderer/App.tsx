import { useState, useCallback, useEffect } from 'react'
import { AddCompetitor } from './components/AddCompetitor'
import { CompetitorList } from './components/CompetitorList'
import { CompetitorDetail } from './components/CompetitorDetail'
import { AlertsPanel } from './components/AlertsPanel'
import { SysInfo } from './components/SysInfo'

type View =
  | { page: 'home' }
  | { page: 'alerts' }
  | { page: 'detail'; competitorId: number }
  | { page: 'sysinfo' }

function App(): JSX.Element {
  const [view, setView] = useState<View>({ page: 'home' })
  const [refreshKey, setRefreshKey] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnread = useCallback(async () => {
    try {
      const count = await window.api.alertsCountUnread()
      setUnreadCount(count)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    refreshUnread()
    const interval = setInterval(refreshUnread, 30_000)
    return () => clearInterval(interval)
  }, [refreshUnread])

  const navigateHome = useCallback(() => {
    setView({ page: 'home' })
    setRefreshKey((k) => k + 1)
  }, [])

  const navigateDetail = useCallback((competitorId: number) => {
    setView({ page: 'detail', competitorId })
  }, [])

  const onCaptureDone = useCallback(() => {
    setRefreshKey((k) => k + 1)
    refreshUnread()
  }, [refreshUnread])

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo">R</div>
          <span className="app-title">Amazon Competitor Radar</span>
        </div>
        <nav className="app-nav">
          <button
            className={`nav-btn ${view.page === 'home' ? 'active' : ''}`}
            onClick={navigateHome}
          >
            Dashboard
          </button>
          <button
            className={`nav-btn ${view.page === 'alerts' ? 'active' : ''}`}
            onClick={() => setView({ page: 'alerts' })}
          >
            Alerts
            {unreadCount > 0 && (
              <span
                style={{
                  background: 'var(--status-error)',
                  color: '#fff',
                  borderRadius: 100,
                  padding: '0 6px',
                  fontSize: 10,
                  fontWeight: 700,
                  marginLeft: 4,
                  lineHeight: '16px',
                  display: 'inline-block',
                  minWidth: 16,
                  textAlign: 'center'
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <button
            className={`nav-btn ${view.page === 'sysinfo' ? 'active' : ''}`}
            onClick={() => setView({ page: 'sysinfo' })}
          >
            System
          </button>
        </nav>
      </header>

      <main className="app-main">
        {view.page === 'home' && (
          <>
            <section style={{ marginBottom: 24 }}>
              <AddCompetitor onCaptureDone={onCaptureDone} />
            </section>
            <CompetitorList
              key={refreshKey}
              onViewDetail={navigateDetail}
              onRefresh={() => setRefreshKey((k) => k + 1)}
            />
          </>
        )}
        {view.page === 'alerts' && <AlertsPanel />}
        {view.page === 'detail' && (
          <CompetitorDetail competitorId={view.competitorId} onBack={navigateHome} />
        )}
        {view.page === 'sysinfo' && <SysInfo />}
      </main>
    </div>
  )
}

export default App
