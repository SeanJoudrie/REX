import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import Icon from './Icon'

// Catches render-time crashes (e.g. a malformed item slipping past toTitle) so a
// single throw can't white-screen the whole app — status==='error' only covers
// fetch failures, not render.
export default class ErrorBoundary extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false }
  static getDerivedStateFromError() { return { err: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('REX crashed:', error, info) }

  render() {
    if (!this.state.err) return this.props.children
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 28, color: '#F4F4F7' }}>
        <div style={{ color: '#f6c244', marginBottom: 14 }}><Icon name="warning" size={44} /></div>
        <div style={{ fontSize: 19, fontWeight: 800 }}>Something hiccupped</div>
        <div style={{ marginTop: 8, fontSize: 13.5, opacity: 0.7, maxWidth: 300, lineHeight: 1.5 }}>
          REX hit an unexpected error. Your watchlist and ratings are saved — reloading should fix it.
        </div>
        <button onClick={() => window.location.reload()}
          style={{ marginTop: 20, padding: '13px 26px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', background: '#22c55e', color: '#06210f', border: 'none' }}>
          Reload
        </button>
      </div>
    )
  }
}
