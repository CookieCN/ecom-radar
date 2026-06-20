import { useState, useEffect } from 'react'
import { useT, useLang } from '../i18n'
import type {
  HealthCheckResult,
  DbHealthCheckResult,
  DeliveryProfile,
  PageBudgetView
} from '../../shared/ipc'

export function SysInfo(): JSX.Element {
  const t = useT()
  const { lang, setLang } = useLang()
  const [health, setHealth] = useState<HealthCheckResult | null>(null)
  const [dbHealth, setDbHealth] = useState<DbHealthCheckResult | null>(null)
  const [schedState, setSchedState] = useState<string>('unknown')
  const [deliveryProfiles, setDeliveryProfiles] = useState<DeliveryProfile[]>([])
  const [deliverySaveState, setDeliverySaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [pageBudget, setPageBudget] = useState<PageBudgetView | null>(null)
  const [budgetInput, setBudgetInput] = useState(80)

  useEffect(() => {
    if (!window.api) return
    window.api
      .healthCheck()
      .then(setHealth)
      .catch(() => {})
    window.api
      .dbHealthCheck()
      .then(setDbHealth)
      .catch(() => {})
    window.api
      .schedulerStatus()
      .then((s) => setSchedState(s.state))
      .catch(() => {})
    window.api
      .deliveryProfilesList()
      .then(setDeliveryProfiles)
      .catch(() => {})
    window.api
      .pageBudgetStatus()
      .then((value) => {
        setPageBudget(value)
        setBudgetInput(value.limit)
      })
      .catch(() => {})
  }, [])

  const saveDeliveryProfiles = async (): Promise<void> => {
    setDeliverySaveState('saving')
    try {
      const saved = await window.api.deliveryProfilesSave(
        deliveryProfiles.map((profile) => ({
          marketplace: profile.marketplace,
          location: profile.location
        }))
      )
      setDeliveryProfiles(saved)
      setDeliverySaveState('saved')
      window.setTimeout(() => setDeliverySaveState('idle'), 2000)
    } catch {
      setDeliverySaveState('idle')
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">{t('sysinfo.systemInfo')}</span>
        </div>
        <div className="card-body">
          {!health && <div className="loading-pulse" />}
          {health && (
            <div className="sys-grid">
              <div className="sys-item">
                <div className="sys-item-label">{t('sysinfo.electron')}</div>
                <div className="sys-item-value">{health.electronVersion}</div>
              </div>
              <div className="sys-item">
                <div className="sys-item-label">{t('sysinfo.nodejs')}</div>
                <div className="sys-item-value">{health.nodeVersion}</div>
              </div>
              <div className="sys-item">
                <div className="sys-item-label">{t('sysinfo.platform')}</div>
                <div className="sys-item-value">{health.platform}</div>
              </div>
              <div className="sys-item">
                <div className="sys-item-label">{t('sysinfo.status')}</div>
                <div className="sys-item-value">
                  <span className="badge badge-active">OK</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">{t('sysinfo.database')}</span>
        </div>
        <div className="card-body">
          {!dbHealth && <div className="loading-pulse" />}
          {dbHealth && (
            <>
              <div className="sys-grid" style={{ marginBottom: 16 }}>
                <div className="sys-item">
                  <div className="sys-item-label">{t('sysinfo.migrationVersion')}</div>
                  <div className="sys-item-value">{dbHealth.migrationVersion}</div>
                </div>
                <div className="sys-item">
                  <div className="sys-item-label">{t('sysinfo.dbPath')}</div>
                  <div className="sys-item-value" style={{ fontSize: 11, wordBreak: 'break-all' }}>
                    {dbHealth.dbPath}
                  </div>
                </div>
              </div>
              <div className="sys-grid">
                {Object.entries(dbHealth.tableCounts).map(([table, count]) => (
                  <div className="sys-item" key={table}>
                    <div className="sys-item-label">{table}</div>
                    <div className="sys-item-value">{t('sysinfo.rows', String(count))}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">{t('sysinfo.scheduler')}</span>
        </div>
        <div className="card-body">
          <div className="sys-grid" style={{ marginBottom: 12 }}>
            <div className="sys-item">
              <div className="sys-item-label">{t('sysinfo.state')}</div>
              <div className="sys-item-value">
                <span
                  className={`badge ${schedState === 'running' ? 'badge-active' : 'badge-paused'}`}
                >
                  {schedState}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => window.api.schedulerStart()}>
              {t('sysinfo.start')}
            </button>
            <button className="btn btn-secondary" onClick={() => window.api.schedulerStop()}>
              {t('sysinfo.stop')}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">{t('sysinfo.pageBudget')}</span>
          <span className="delivery-profile-note">{t('sysinfo.pageBudgetHint')}</span>
        </div>
        <div className="card-body">
          <div className="sys-grid" style={{ marginBottom: 12 }}>
            <div className="sys-item">
              <div className="sys-item-label">{t('sysinfo.budgetUsed')}</div>
              <div className="sys-item-value">
                {pageBudget ? `${pageBudget.used}/${pageBudget.limit}` : '—'}
              </div>
            </div>
            <div className="sys-item">
              <div className="sys-item-label">{t('sysinfo.budgetRemaining')}</div>
              <div className="sys-item-value">{pageBudget?.remaining ?? '—'}</div>
            </div>
            <div className="sys-item">
              <div className="sys-item-label">{t('sysinfo.deferred')}</div>
              <div className="sys-item-value">{pageBudget?.deferred ?? '—'}</div>
            </div>
            <div className="sys-item">
              <div className="sys-item-label">{t('sysinfo.cooldowns')}</div>
              <div className="sys-item-value">{pageBudget?.cooldowns.length ?? 0}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="input"
              type="number"
              min={1}
              max={100}
              value={budgetInput}
              onChange={(event) => setBudgetInput(Number(event.target.value))}
              style={{ maxWidth: 120 }}
            />
            <button
              className="btn btn-primary"
              onClick={async () => {
                const saved = await window.api.pageBudgetSave(budgetInput)
                setPageBudget(saved)
                setBudgetInput(saved.limit)
              }}
            >
              {t('sysinfo.saveBudget')}
            </button>
          </div>
          {pageBudget?.cooldowns.map((cooldown) => (
            <div className="text-muted" key={cooldown.marketplace} style={{ marginTop: 8 }}>
              {cooldown.marketplace}: {cooldown.reason} ·{' '}
              {new Date(cooldown.endsAt).toLocaleString()}
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">{t('sysinfo.deliveryProfiles')}</span>
          <span className="delivery-profile-note">{t('sysinfo.deliveryProfilesHint')}</span>
        </div>
        <div className="card-body">
          <div className="delivery-profile-grid">
            {deliveryProfiles.map((profile, index) => (
              <label className="delivery-profile-row" key={profile.marketplace}>
                <span className="delivery-profile-market">{profile.marketplace}</span>
                <span className="delivery-profile-currency">{profile.currency}</span>
                <input
                  className="input"
                  value={profile.location}
                  aria-label={`${profile.marketplace} ${t('sysinfo.deliveryLocation')}`}
                  placeholder={profile.defaultLocation}
                  onChange={(event) => {
                    const next = deliveryProfiles.slice()
                    next[index] = { ...profile, location: event.target.value }
                    setDeliveryProfiles(next)
                    setDeliverySaveState('idle')
                  }}
                />
                <span className="delivery-profile-kind">
                  {profile.locationMode === 'postalCode'
                    ? t('sysinfo.postalCode')
                    : t('sysinfo.city')}
                </span>
              </label>
            ))}
          </div>
          <div className="delivery-profile-actions">
            <button
              className="btn btn-primary"
              onClick={saveDeliveryProfiles}
              disabled={deliverySaveState === 'saving'}
            >
              {deliverySaveState === 'saving'
                ? t('sysinfo.savingDelivery')
                : t('sysinfo.saveDelivery')}
            </button>
            {deliverySaveState === 'saved' && (
              <span className="delivery-profile-saved">{t('sysinfo.deliverySaved')}</span>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('sysinfo.language')}</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn ${lang === 'en' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setLang('en')}
            >
              English
            </button>
            <button
              className={`btn ${lang === 'zh-CN' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setLang('zh-CN')}
            >
              中文
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
