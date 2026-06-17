import Link from 'next/link'
import { UserCog, ArrowRight } from 'lucide-react'
import styles from './usuarios.module.css'

export default function UsuariosPage() {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Usuarios</h1>
      </header>

      <div className={styles.body}>
        <div className={styles.emptyState} role="status">
          <div className={styles.iconWrap} aria-hidden="true">
            <UserCog size={36} strokeWidth={1.5} />
          </div>

          <span className={styles.badge}>En desarrollo</span>

          <h2 className={styles.emptyTitle}>Vista dedicada en construcción</h2>

          <p className={styles.emptyDesc}>
            Esta sección mostrará una interfaz completa para crear y administrar
            usuarios del sistema. Mientras tanto, la gestión de usuarios ya está
            disponible en Configuración.
          </p>

          <Link href="/configuracion" className={styles.link}>
            Ir a Configuración → Usuarios
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  )
}
