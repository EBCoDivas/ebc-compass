import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State { return { hasError: true } }

  componentDidCatch(error: Error, info: ErrorInfo) { console.error('EBC Compass render error', error, info) }

  render() {
    if (this.state.hasError) return <main className="page"><section className="welcome-card"><h1>Algo salió mal</h1><p>Recarga la página para continuar usando EBC Compass.</p><button className="button primary" onClick={() => window.location.reload()}>Recargar</button></section></main>
    return this.props.children
  }
}
