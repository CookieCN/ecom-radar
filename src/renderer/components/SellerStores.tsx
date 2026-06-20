import { useCallback, useEffect, useState } from 'react'
import { useT } from '../i18n'
import type { SellerStoreDetail, SellerStoreListItem } from '../../shared/ipc'

export function SellerStores(): JSX.Element {
  const t = useT()
  const [stores, setStores] = useState<SellerStoreListItem[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [detail, setDetail] = useState<SellerStoreDetail | null>(null)
  const [url, setUrl] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const loadStores = useCallback(async () => setStores(await window.api.sellerStoresList()), [])
  const loadDetail = useCallback(
    async (id: number) => setDetail(await window.api.sellerStoresGet(id)),
    []
  )

  useEffect(() => {
    loadStores().catch(() => setMessage(t('stores.loadError')))
  }, [loadStores, t])

  useEffect(() => {
    if (selected) loadDetail(selected).catch(() => setMessage(t('stores.loadError')))
  }, [selected, loadDetail, t])

  const addStore = async (): Promise<void> => {
    setBusy(true)
    setMessage('')
    try {
      const result = await window.api.sellerStoresAdd(url)
      if (!result.success) setMessage(result.error ?? t('stores.addError'))
      else {
        setUrl('')
        await loadStores()
        if (result.storeId) setSelected(result.storeId)
      }
    } finally {
      setBusy(false)
    }
  }

  if (selected && detail) {
    return (
      <>
        <button
          className="btn btn-secondary"
          onClick={() => {
            setSelected(null)
            setDetail(null)
            loadStores()
          }}
        >
          &larr; {t('stores.back')}
        </button>
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <div>
              <div className="card-title">{detail.name || detail.sellerId}</div>
              <div className="text-muted">
                {detail.marketplace} · {detail.sellerId}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary"
                onClick={async () => {
                  const result = await window.api.sellerStoresToggle(detail.id)
                  setMessage(result.status === 'paused' ? t('stores.paused') : t('stores.resumed'))
                  await loadDetail(detail.id)
                }}
              >
                {detail.status === 'paused' ? t('stores.resume') : t('stores.pause')}
              </button>
              <button
                className="btn btn-secondary"
                onClick={async () => {
                  await window.api.sellerStoresDelete(detail.id)
                  setSelected(null)
                  setDetail(null)
                  await loadStores()
                }}
              >
                {t('stores.delete')}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => window.open(detail.storefrontUrl, '_blank')}
              >
                {t('stores.openAmazon')}
              </button>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  const result = await window.api.sellerStoresScan(detail.id)
                  setMessage(
                    result.success
                      ? result.errorType
                        ? t(
                            'stores.scanPartial',
                            String(result.scannedProducts),
                            result.errorMessage ?? result.errorType
                          )
                        : t(
                            'stores.scanDone',
                            String(result.scannedProducts),
                            String(result.deepProducts)
                          )
                      : result.errorMessage || t('stores.scanFailed')
                  )
                  await loadDetail(detail.id)
                  setBusy(false)
                }}
              >
                {busy ? t('stores.scanning') : t('stores.scanNow')}
              </button>
            </div>
          </div>
          <div className="card-body">
            {message && (
              <div className="alert-inline" style={{ marginBottom: 12 }}>
                {message}
              </div>
            )}
            <div className="sys-grid">
              <Metric label={t('stores.reported')} value={detail.reportedProductCount} />
              <Metric label={t('stores.scanned')} value={detail.scannedProductCount} />
              <Metric label={t('stores.known')} value={detail.knownProductCount} />
              <Metric label={t('stores.missing')} value={detail.missingCount} />
              <Metric label={t('stores.rating')} value={detail.publicRating} />
              <Metric label={t('stores.feedback')} value={detail.feedbackCount} />
              <Metric label={t('stores.positive30')} value={percent(detail.positive30d)} />
              <Metric label={t('stores.positive90')} value={percent(detail.positive90d)} />
              <Metric label={t('stores.positive365')} value={percent(detail.positive365d)} />
              <Metric
                label={t('stores.budget')}
                value={`${detail.budget.used}/${detail.budget.limit}`}
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-title">{t('stores.products')}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('stores.product')}</th>
                  <th>ASIN</th>
                  <th>{t('stores.price')}</th>
                  <th>{t('stores.rating')}</th>
                  <th>{t('stores.availability')}</th>
                  <th>{t('stores.freshness')}</th>
                  <th>{t('stores.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {detail.products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {product.imageUrl && (
                          <img src={product.imageUrl} alt="" className="product-thumb" />
                        )}
                        <span>{product.title || t('stores.untitled')}</span>
                      </div>
                    </td>
                    <td className="cell-asin">{product.asin}</td>
                    <td>
                      {formatPrice(product.detailPrice ?? product.listingPrice, product.currency)}
                    </td>
                    <td>
                      {product.rating ?? '—'}
                      {product.reviewCount != null ? ` (${product.reviewCount})` : ''}
                    </td>
                    <td>{product.availability || product.presenceStatus}</td>
                    <td>{freshness(product.detailCapturedAt, t)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary"
                          onClick={async () => {
                            await window.api.sellerStoreProductWatch(product.id, !product.watched)
                            await loadDetail(detail.id)
                          }}
                        >
                          {product.watched ? t('stores.unwatch') : t('stores.watch')}
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={async () => {
                            await window.api.sellerStoreProductPromote(product.id)
                            setMessage(t('stores.promoted'))
                          }}
                        >
                          {t('stores.promote')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-title">{t('stores.events')}</span>
          </div>
          <div className="card-body">
            {detail.events.length === 0 ? (
              <div className="empty-state">{t('stores.noEvents')}</div>
            ) : (
              detail.events.map((event) => (
                <div
                  key={event.id}
                  style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}
                >
                  <strong>{t(`stores.eventTypes.${event.eventType}`)}</strong> ·{' '}
                  {event.newValue || event.oldValue || ''}
                  <span className="text-muted" style={{ marginLeft: 8 }}>
                    {new Date(event.detectedAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">{t('stores.addTitle')}</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder={t('stores.placeholder')}
            />
            <button className="btn btn-primary" disabled={busy || !url.trim()} onClick={addStore}>
              {t('stores.add')}
            </button>
          </div>
          {message && (
            <div className="text-muted" style={{ marginTop: 8 }}>
              {message}
            </div>
          )}
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('stores.title')}</span>
        </div>
        {stores.length === 0 ? (
          <div className="empty-state">{t('stores.empty')}</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('stores.store')}</th>
                  <th>{t('stores.market')}</th>
                  <th>{t('stores.reported')}</th>
                  <th>{t('stores.scanned')}</th>
                  <th>{t('stores.new')}</th>
                  <th>{t('stores.missing')}</th>
                  <th>{t('stores.status')}</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr
                    key={store.id}
                    onClick={() => setSelected(store.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{store.name || store.sellerId}</td>
                    <td>{store.marketplace}</td>
                    <td>{store.reportedProductCount ?? '—'}</td>
                    <td>{store.scannedProductCount}</td>
                    <td>{store.newCount}</td>
                    <td>{store.missingCount}</td>
                    <td>
                      <span className={`badge badge-${store.status}`}>{store.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function Metric({ label, value }: { label: string; value: string | number | null }): JSX.Element {
  return (
    <div className="sys-item">
      <div className="sys-item-label">{label}</div>
      <div className="sys-item-value">{value ?? '—'}</div>
    </div>
  )
}

function percent(value: number | null): string {
  return value == null ? '—' : `${value}%`
}
function formatPrice(value: number | null, currency: string | null): string {
  return value == null ? '—' : `${currency || ''} ${value.toFixed(2)}`.trim()
}
function freshness(value: string | null, t: ReturnType<typeof useT>): string {
  if (!value) return t('stores.pending')
  return Date.now() - new Date(value).getTime() > 7 * 86400000
    ? t('stores.stale')
    : t('stores.fresh')
}
