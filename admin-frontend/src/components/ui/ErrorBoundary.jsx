import React from 'react'
import { AlertOctagon, RefreshCw, Home } from 'lucide-react'

export class ErrorBoundary extends React.Component {
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
    if (this.state.hasError) {
      return (
        <div className="vanguard-error-boundary-screen">
          <div className="vanguard-error-boundary-card">
            <div className="vanguard-error-boundary-icon">
              <AlertOctagon size={40} />
            </div>
            <h2>Une erreur inattendue est survenue</h2>
            <p>
              L’application a rencontré un problème d’affichage. Aucune donnée n’a été perdue.
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
                <span>Retour à l’accueil</span>
              </button>
              <button
                type="button"
                className="vanguard-btn vanguard-btn--primary vanguard-btn--md"
                onClick={this.handleReset}
              >
                <RefreshCw size={16} />
                <span>Recharger la page</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
