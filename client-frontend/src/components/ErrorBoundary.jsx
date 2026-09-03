import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Client frontend render error', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main role="alert" className="page-state">
          <h1>Une erreur est survenue.</h1>
          <p>Veuillez réessayer.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Réessayer
          </button>
        </main>
      )
    }

    return this.props.children
  }
}
