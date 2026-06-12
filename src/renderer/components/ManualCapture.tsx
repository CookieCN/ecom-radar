import { useState, useCallback, FormEvent } from 'react'
import type { CaptureResponse, CompetitorDetail } from '../../shared/ipc'

interface Props {
  competitor: CompetitorDetail
  onSaved: () => void
}

export function ManualCapture({ competitor, onSaved }: Props): JSX.Element {
  const [price, setPrice] = useState('')
  const [rating, setRating] = useState('')
  const [reviews, setReviews] = useState('')
  const [availability, setAvailability] = useState('In Stock')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CaptureResponse | null>(null)

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
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
        if (res.success) {
          setPrice('')
          setRating('')
          setReviews('')
          onSaved()
        }
      } catch (err) {
        setResult({
          success: false,
          errorType: 'UNKNOWN_ERROR',
          errorMessage: err instanceof Error ? err.message : 'Save failed'
        })
      } finally {
        setLoading(false)
      }
    },
    [competitor, price, rating, reviews, availability, loading, onSaved]
  )

  const openInBrowser = useCallback(() => {
    window.open(competitor.url, '_blank')
  }, [competitor.url])

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <span className="card-title">Manual Capture</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Auto-capture unavailable — enter data manually
        </span>
      </div>
      <div className="card-body">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Open the product page in your browser, check the current values, and enter them below.
        </p>
        <button className="btn btn-secondary" onClick={openInBrowser} style={{ marginBottom: 12 }}>
          &#8599; Open {competitor.asin} on Amazon
        </button>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginBottom: 12
            }}
          >
            <div>
              <label style={labelStyle}>Price ($)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                placeholder="e.g. 24.99"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label style={labelStyle}>Rating (★)</label>
              <input
                className="input"
                type="number"
                step="0.1"
                min="0"
                max="5"
                placeholder="e.g. 4.5"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label style={labelStyle}>Review Count</label>
              <input
                className="input"
                type="number"
                step="1"
                placeholder="e.g. 1234"
                value={reviews}
                onChange={(e) => setReviews(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label style={labelStyle}>Availability</label>
              <select
                className="input"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                disabled={loading}
              >
                <option>In Stock</option>
                <option>Out of Stock</option>
                <option>Pre-order</option>
                <option>Currently unavailable</option>
              </select>
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" /> Saving…
              </>
            ) : (
              'Save Manual Snapshot'
            )}
          </button>
        </form>

        {result && (
          <div className="capture-result">
            {result.success ? (
              <div className="alert alert-success">
                <span className="alert-icon">&#10003;</span>
                <div>Snapshot saved successfully.</div>
              </div>
            ) : (
              <div className="alert alert-error">
                <span className="alert-icon">&#10007;</span>
                <div>
                  <strong>{result.errorType || 'Error'}</strong> — {result.errorMessage}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: 4
}
