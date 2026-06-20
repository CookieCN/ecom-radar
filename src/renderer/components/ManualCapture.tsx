import { useState, useCallback, FormEvent } from 'react'
import { useT } from '../i18n'
import type { CaptureResponse, CompetitorDetail } from '../../shared/ipc'

interface Props { competitor: CompetitorDetail; onSaved: () => void }

function getMarketplaceCurrency(marketplace: string): string {
  const map: Record<string, string> = {
    US: 'USD',
    CA: 'CAD',
    MX: 'MXN',
    BR: 'BRL',
    UK: 'GBP',
    DE: 'EUR',
    FR: 'EUR',
    IT: 'EUR',
    ES: 'EUR',
    JP: 'JPY',
    IN: 'INR',
    AU: 'AUD',
    AE: 'AED'
  }
  return map[marketplace] ?? 'USD'
}

export function ManualCapture({ competitor, onSaved }: Props): JSX.Element {
  const t = useT()
  const [price, setPrice] = useState('')
  const [rating, setRating] = useState('')
  const [reviews, setReviews] = useState('')
  const [availability, setAvailability] = useState(t('manual.inStock'))
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CaptureResponse | null>(null)
  const currency = getMarketplaceCurrency(competitor.marketplace)

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setResult(null)
    try {
      const res = await window.api.captureManualSave({
        competitorId: competitor.id,
        title: competitor.title || '',
        price: price ? parseFloat(price) : null,
        rating: rating ? parseFloat(rating) : null,
        reviewCount: reviews ? parseInt(reviews, 10) : null,
        availability
      })
      setResult(res)
      if (res.success) { setPrice(''); setRating(''); setReviews(''); onSaved() }
    } catch (err) {
      setResult({ success: false, errorType: 'UNKNOWN_ERROR', errorMessage: err instanceof Error ? err.message : 'Save failed' })
    } finally { setLoading(false) }
  }, [competitor, price, rating, reviews, availability, loading, onSaved])

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <span className="card-title">{t('manual.title')}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('manual.subtitle')}</span>
      </div>
      <div className="card-body">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{t('manual.desc')}</p>
        <button className="btn btn-secondary" onClick={() => window.open(competitor.url, '_blank')} style={{ marginBottom: 12 }}>
          &#8599; {t('manual.openAmazon', competitor.asin)}
        </button>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><label style={labelStyle}>{t('manual.price', currency)}</label><input className="input" type="number" step="0.01" placeholder="e.g. 24.99" value={price} onChange={(e) => setPrice(e.target.value)} disabled={loading} /></div>
            <div><label style={labelStyle}>{t('manual.rating')}</label><input className="input" type="number" step="0.1" min="0" max="5" placeholder="e.g. 4.5" value={rating} onChange={(e) => setRating(e.target.value)} disabled={loading} /></div>
            <div><label style={labelStyle}>{t('manual.reviews')}</label><input className="input" type="number" step="1" placeholder="e.g. 1234" value={reviews} onChange={(e) => setReviews(e.target.value)} disabled={loading} /></div>
            <div><label style={labelStyle}>{t('manual.availability')}</label><select className="input" value={availability} onChange={(e) => setAvailability(e.target.value)} disabled={loading}>
              <option>{t('manual.inStock')}</option><option>{t('manual.outOfStock')}</option><option>{t('manual.preOrder')}</option><option>{t('manual.unavailable')}</option>
            </select></div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <><span className="spinner" /> {t('manual.saving')}</> : t('manual.save')}
          </button>
        </form>
        {result && (
          <div className="capture-result">
            {result.success
              ? <div className="alert alert-success"><span className="alert-icon">&#10003;</span><div>{t('manual.saved')}</div></div>
              : <div className="alert alert-error"><span className="alert-icon">&#10007;</span><div><strong>{result.errorType || t('add.error')}</strong> — {result.errorMessage}</div></div>
            }
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }
