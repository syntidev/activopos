import { RotateCcw } from 'lucide-react'
import styles from './devoluciones.module.css'

export default function DevolucionesPage() {
  return (
    <div className={`${styles.page} page-container`}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Devoluciones</h1>
      </header>

      <div className={styles.body}>
        <div className={styles.emptyState} role="status">
          <div className={styles.iconWrap} aria-hidden="true">
            <RotateCcw size={36} strokeWidth={1.5} />
          </div>

          <span className={styles.badge}>En desarrollo</span>

          <h2 className={styles.emptyTitle}>Módulo en construcción</h2>

          <p className={styles.emptyDesc}>
            Gestiona la reversión de ventas pagadas, reintegro de pagos al cliente
            y ajuste automático del inventario. Por ahora, las anulaciones están
            disponibles desde la sección Reportes.
          </p>
        </div>
      </div>
    </div>
  )
}
