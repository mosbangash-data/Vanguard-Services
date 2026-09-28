import React from 'react'
import { AlertOctagon, RefreshCw, Home } from 'lucide-react'
import { LanguageContext } from '../../i18n/LanguageContext'

export class ErrorBoundary extends React.Component {
  static contextType = LanguageContext
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    const t = this.context?.t || ((key) => key)
    if (this.state.hasError) {
      return (
        <div className="vanguard-error-boundary-screen">
          <div className="vanguard-error-boundary-card">
            <div className="vanguard-error-boundary-icon">
              <AlertOctagon size={40} />
            </div>
            <h2>{t('errorBoundary.title')}</h2>
            <p>
              {t('errorBoundary.description')}
            </p>
            {this.state.error?.message && (
              <pre className="vanguard-error-boundary-details">
                {this.state.error.message}
              </pre>
            )}
            <div className="vanguard-error-boundary-actions">
              <button
                type="button"
                className="vanguard-btn vanguard-btn--secondary vanguard-btn--md"
                onClick={() => { window.location.href = '/admin' }}
              >
                <Home size={16} />
                <span>{t('errorBoundary.home')}</span>
              </button>
              <button
                type="button"
                className="vanguard-btn vanguard-btn--primary vanguard-btn--md"
                onClick={this.handleReset}
              >
                <RefreshCw size={16} />
                <span>{t('errorBoundary.reload')}</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
