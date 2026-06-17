import { FileText } from 'lucide-react'
import styles from './cotizaciones.module.css'

export default function CotizacionesPage() {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Cotizaciones</h1>
      </header>

      <div className={styles.body}>
        <div className={styles.emptyState} role="status">
          <div className={styles.iconWrap} aria-hidden="true">
            <FileText size={36} strokeWidth={1.5} />
          </div>

          <span className={styles.badge}>En desarrollo</span>

          <h2 className={styles.emptyTitle}>Módulo en construcción</h2>

          <p className={styles.emptyDesc}>
            Genera presupuestos formales para clientes antes de confirmar la venta.
            El módulo incluirá creación de cotizaciones, historial por cliente
            y conversión directa a venta con un clic.
          </p>
        </div>
      </div>
    </div>
  )
}
