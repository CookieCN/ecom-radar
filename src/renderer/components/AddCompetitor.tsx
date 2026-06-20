import { useState, useCallback, FormEvent } from 'react'
import { useT } from '../i18n'
import type { CaptureResponse } from '../../shared/ipc'

interface Props {
  onCaptureDone: () => void
}

const MARKETPLACE_OPTIONS = [
  'US',
  'UK',
  'DE',
  'FR',
  'IT',
  'ES',
  'JP',
  'CA',
  'MX',
  'BR',
  'AU',
  'IN',
  'AE'
]

export function AddCompetitor({ onCaptureDone }: Props): JSX.Element {
  const t = useT()
  const [input, setInput] = useState('')
  const [marketplace, setMarketplace] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CaptureResponse | null>(null)

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const trimmed = input.trim()
      if (!trimmed || loading) return
      if (!marketplace) {
        setResult({
          success: false,
          errorType: 'PARSER_FAILED',
          errorMessage: t('add.marketplaceRequired')
        })
        return
      }

      setLoading(true)
      setResult(null)

      try {
        if (!window.api) {
          setResult({ success: false, errorType: 'UNKNOWN_ERROR', errorMessage: t('errors.stillLoading') })
          return
        }
        const res = await window.api.captureRun({ input: trimmed, marketplace })
        setResult(res)
        if (res.success) {
          setInput('')
          onCaptureDone()
        }
      } catch (err) {
        setResult({
          success: false,
          errorType: 'UNKNOWN_ERROR',
          errorMessage: err instanceof Error ? err.message : 'Capture request failed'
        })
      } finally {
        setLoading(false)
      }
    },
    [input, loading, marketplace, onCaptureDone, t]
  )

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{t('add.title')}</span>
      </div>
      <div className="card-body">
        <form className="add-form" onSubmit={handleSubmit}>
          <select
            className="input add-marketplace-select"
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value)}
            disabled={loading}
            required
            aria-label={t('add.marketplaceLabel')}
          >
            <option value="">{t('add.marketplacePlaceholder')}</option>
            {MARKETPLACE_OPTIONS.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
          <input
            className="input"
            type="text"
            placeholder={t('add.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <button className="btn btn-primary" type="submit" disabled={loading || !input.trim() || !marketplace}>
            {loading ? (
              <><span className="spinner" /> {t('add.capturing')}</>
            ) : (
              t('add.button')
            )}
          </button>
        </form>
        <p className="add-hint">
          {t('add.hint', 'https://www.amazon.com/dp/B0EXAMPLE', 'B0EXAMPLE1')}
        </p>

        {result && (
          <div className="capture-result">
            {result.success ? (
              <div className="alert alert-success">
                <span className="alert-icon">&#10003;</span>
                <div>
                  <strong>{t('add.success')}</strong>
                  {result.title && <> — {result.title}</>}
                  {result.price && <> at ${result.price}</>}
                  {result.rating && <> · {result.rating}&#9733;</>}
                </div>
              </div>
            ) : (
              <div className="alert alert-error">
                <span className="alert-icon">&#10007;</span>
                <div>
                  <strong>{result.errorType || t('add.error')}</strong> — {result.errorMessage}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
