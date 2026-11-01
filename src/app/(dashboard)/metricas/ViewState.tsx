import type { ReactNode } from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import styles from './metricas.module.css'

interface ViewStateProps {
  loading: boolean
  error: string | null
  /** true = la consulta salió bien pero no hay filas */
  empty: boolean
  emptyTitle: string
  emptyHint: string
  onRetry: () => void
  children: ReactNode
}

/** Estados de una vista: cargando, error (con reintento), vacío con texto útil, o el contenido. */
export function ViewState({ loading, error, empty, emptyTitle, emptyHint, onRetry, children }: ViewStateProps) {
  if (loading) return <div className={styles.state} role="status" aria-live="polite">Cargando tus ventas…</div>
  if (error) {
    return (
      <div className={styles.state} role="alert" data-testid="metricas-error">
        <AlertTriangle size={28} strokeWidth={1.75} aria-hidden="true" />
        <p className={styles.stateTitle}>No pudimos cargar esto</p>
        <p className={styles.stateHint}>{error}</p>
        <Button variant="secondary" size="sm" onClick={onRetry}>Reintentar</Button>
      </div>
    )
  }
  if (empty) {
    return (
      <div className={styles.state} data-testid="metricas-vacio">
        <Inbox size={28} strokeWidth={1.75} aria-hidden="true" />
        <p className={styles.stateTitle}>{emptyTitle}</p>
        <p className={styles.stateHint}>{emptyHint}</p>
      </div>
    )
  }
  return <>{children}</>
}
