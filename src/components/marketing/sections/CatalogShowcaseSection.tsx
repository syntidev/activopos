import Link from 'next/link'
import { Store, LayoutGrid, MessageCircle, ArrowRight } from 'lucide-react'
import styles from './CatalogShowcaseSection.module.css'

const PREVIEWS = [
  {
    Icon:  Store,
    title: 'Vitrina',
    desc:  'tutienda.activopos.com, sincronizada con tu inventario del POS en tiempo real.',
  },
  {
    Icon:  LayoutGrid,
    title: 'Catálogo',
    desc:  'Tus productos organizados por categoría, con precio y disponibilidad siempre al día.',
  },
  {
    Icon:  MessageCircle,
    title: 'Pedido por WhatsApp',
    desc:  'Tu cliente arma el pedido, te llega listo al WhatsApp del negocio. Tú lo confirmas.',
  },
]

export default function CatalogShowcaseSection() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.head}>
          <h2 className={styles.title}>Cuando quieras vender también en la calle.</h2>
          <p className={styles.subtitle}>
            Un catálogo digital conectado a tu inventario del mostrador — sin mover un dedo.
            Tu código QR propio, para compartir donde quieras.
          </p>
        </div>

        <div className={styles.grid}>
          {PREVIEWS.map(({ Icon, title, desc }) => (
            <div key={title} className={styles.card}>
              <span className={styles.ghostIcon} aria-hidden="true">
                <Icon size={72} />
              </span>
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardDesc}>{desc}</p>
            </div>
          ))}
        </div>

        <div className={styles.moreWrap}>
          <Link href="/catalogo/multi-demo" className={styles.moreLink}>
            Ver catálogo de ejemplo
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
