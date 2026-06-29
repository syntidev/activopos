import { Metadata } from 'next'
import Link from 'next/link'
import { Store, ArrowRight } from 'lucide-react'
import styles from './catalogo-landing.module.css'

export const metadata: Metadata = {
  title: 'Catálogo Digital — ActivoPOS',
  description: 'Cada negocio tiene su propio catálogo digital. Crea el tuyo con ActivoPOS.',
}

export default function CatalogoLandingPage() {
  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <Store size={48} strokeWidth={1.5} />
        </div>
        <h1 className={styles.title}>Catálogo Digital</h1>
        <p className={styles.desc}>
          Cada negocio en ActivoPOS tiene su propio catálogo digital
          con una URL única. Si llegaste aquí, probablemente el enlace
          está incompleto.
        </p>
        <p className={styles.hint}>
          La URL correcta tiene el formato:
        </p>
        <code className={styles.urlExample}>
          activopos.com/catalogo/tu-negocio
        </code>
        <Link href="https://activopos.com" className={styles.cta}>
          Conocer ActivoPOS
          <ArrowRight size={16} />
        </Link>
      </div>
      <footer className={styles.footer}>
        Catálogo digital con{' '}
        <a href="https://activopos.com">ActivoPOS</a>
      </footer>
    </div>
  )
}
