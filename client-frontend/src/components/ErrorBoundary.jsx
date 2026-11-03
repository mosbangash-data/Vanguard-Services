import { Component } from 'react'
import { LanguageContext } from '../i18n/LanguageProvider'

export class ErrorBoundary extends Component {
  static contextType = LanguageContext
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Client frontend render error', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const { t } = this.context || {}
      return (
        <main role="alert" className="page-state">
          <h1>{t?.('states.error') || 'Une erreur est survenue.'}</h1>
          <p>{t?.('states.retry') || 'Veuillez réessayer.'}</p>
          <button type="button" onClick={() => window.location.reload()}>
            {t?.('states.retry') || 'Réessayer'}
          </button>
        </main>
      )
    }

    return this.props.children
  }
}
