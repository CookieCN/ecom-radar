import { useState, useCallback, FormEvent } from 'react'
import type { CaptureResponse } from '../../shared/ipc'

interface Props {
  onCaptureDone: () => void
}

export function AddCompetitor({ onCaptureDone }: Props): JSX.Element {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CaptureResponse | null>(null)

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const trimmed = input.trim()
      if (!trimmed || loading) return

      setLoading(true)
      setResult(null)

      try {
        if (!window.api) {
          setResult({ success: false, errorType: 'UNKNOWN_ERROR', errorMessage: 'App is still loading. Please try again.' })
          return
        }
        const res = await window.api.captureRun({ input: trimmed })
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
    [input, loading, onCaptureDone]
  )

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Add Competitor</span>
      </div>
      <div className="card-body">
        <form className="add-form" onSubmit={handleSubmit}>
          <input
            className="input"
            type="text"
            placeholder="Paste Amazon URL or ASIN (e.g. B09N3YBZ7D)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <button className="btn btn-primary" type="submit" disabled={loading || !input.trim()}>
            {loading ? (
              <>
                <span className="spinner" /> Capturing…
              </>
            ) : (
              'Add & Capture'
            )}
          </button>
        </form>
        <p className="add-hint">
          Accepts <code>https://www.amazon.com/dp/B0EXAMPLE</code> or bare ASIN like{' '}
          <code>B0EXAMPLE1</code>
        </p>

        {result && (
          <div className={`capture-result`}>
            {result.success ? (
              <div className="alert alert-success">
                <span className="alert-icon">&#10003;</span>
                <div>
                  <strong>Captured successfully</strong> — {result.title || 'Product'}
                  {result.price && <> at ${result.price}</>}
                  {result.rating && <> &middot; {result.rating}&#9733;</>}
                </div>
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
