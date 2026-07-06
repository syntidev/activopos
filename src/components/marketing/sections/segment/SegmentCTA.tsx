import Link from 'next/link'
import styles from './SegmentCTA.module.css'

export default function SegmentCTA({ segmentName }: { segmentName: string }) {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <h2 className={styles.headline}>
          Tu {segmentName} merece un sistema que trabaje como tú.
        </h2>
        <p className={styles.subtext}>Sin contratos anuales. Sin instalación. Listo en minutos.</p>
        <Link href="/registro" className={styles.cta}>
          Crear cuenta gratis
        </Link>
        <p className={styles.fineprint}>
          ActivoPOS es tu sistema de control de ventas e inventario.
          No reemplaza tu facturación SENIAT — la complementa.
        </p>
      </div>
    </section>
  )
}
