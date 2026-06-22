'use client'

import React from 'react'
import { AlertCircle } from 'lucide-react'
import styles from './ErrorBoundary.module.css'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  retry = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className={styles.errorState} role="alert" aria-live="assertive">
          <AlertCircle size={32} className={styles.icon} aria-hidden="true" />
          <p className={styles.message}>Error al cargar esta sección</p>
          <button className={styles.retryBtn} onClick={this.retry} type="button">
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
