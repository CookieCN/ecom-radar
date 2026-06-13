import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

function isZh(): boolean {
  try { return navigator.language?.startsWith('zh') } catch { return false }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const zh = isZh()
      return (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-body">
            <div className="alert alert-error">
              <div>
                <strong>{zh ? '出现异常' : 'Something went wrong'}</strong>
                <pre style={{ marginTop: 8, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {this.state.error?.message || 'Unknown error'}
                </pre>
                <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => this.setState({ hasError: false, error: null })}>
                  {zh ? '重试' : 'Try Again'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
