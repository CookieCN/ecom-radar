import { useState, useCallback, useEffect } from 'react'
import { useT } from './i18n'
import { AddCompetitor } from './components/AddCompetitor'
import { CompetitorList } from './components/CompetitorList'
import { CompetitorDetail } from './components/CompetitorDetail'
import { AlertsPanel } from './components/AlertsPanel'
import { SysInfo } from './components/SysInfo'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SellerStores } from './components/SellerStores'

type View =
  | { page: 'home' }
  | { page: 'alerts' }
  | { page: 'detail'; competitorId: number }
  | { page: 'sysinfo' }
  | { page: 'stores' }

function App(): JSX.Element {
  const t = useT()
  const [view, setView] = useState<View>({ page: 'home' })
  const [refreshKey, setRefreshKey] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnread = useCallback(async () => {
    try {
      const count = await window.api.alertsCountUnread()
      setUnreadCount(count)
    } catch {
      /* ignore */
    }
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
          <span className="app-title">{t('app.title')}</span>
        </div>
        <nav className="app-nav">
          <button
            className={`nav-btn ${view.page === 'stores' ? 'active' : ''}`}
            onClick={() => setView({ page: 'stores' })}
          >
            {t('nav.stores')}
          </button>
          <button
            className={`nav-btn ${view.page === 'home' ? 'active' : ''}`}
            onClick={navigateHome}
          >
            {t('nav.dashboard')}
          </button>
          <button
            className={`nav-btn ${view.page === 'alerts' ? 'active' : ''}`}
            onClick={() => setView({ page: 'alerts' })}
          >
            {t('nav.alerts')}
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
            {t('nav.system')}
          </button>
        </nav>
      </header>

      <main className="app-main">
        <ErrorBoundary>
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
          {view.page === 'stores' && <SellerStores />}
        </ErrorBoundary>
      </main>
    </div>
  )
}

export default App
