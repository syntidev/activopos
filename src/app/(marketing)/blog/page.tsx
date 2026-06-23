import type { Metadata } from 'next'
import { BookOpen } from 'lucide-react'
import styles from './blog.module.css'

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Artículos sobre gestión de negocios venezolanos, control de inventario y ventas con ActivoPOS.',
}

const POSTS = [
  {
    category: 'Gestión de negocios',
    title: 'Cómo controlar el inventario de tu bodegón sin volverte loco',
    desc: 'Los errores más comunes al gestionar stock en negocios pequeños y cómo evitarlos con un sistema simple.',
    readTime: '5 min',
  },
  {
    category: 'Dólar y precios',
    title: 'Vender en USD y cobrar en Bs: la guía definitiva para 2026',
    desc: 'Estrategias para fijar precios, ajustar márgenes con la tasa BCV y no perder dinero en la conversión.',
    readTime: '7 min',
  },
  {
    category: 'Tecnología POS',
    title: 'Catálogo digital por WhatsApp: cómo vender sin abrir una tienda online',
    desc: 'Tu catálogo activo en ActivoPOS genera un link que tus clientes pueden compartir y hacer pedidos directamente.',
    readTime: '4 min',
  },
]

export default function BlogPage() {
  return (
    <section className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Blog</p>
        <h1 className={styles.title}>Ideas para negocios activos</h1>
        <p className={styles.subtitle}>
          Artículos prácticos sobre gestión, precios, inventario y tecnología para
          el comercio venezolano.
        </p>

        <div className={styles.grid}>
          {POSTS.map(({ category, title, desc, readTime }) => (
            <article key={title} className={styles.card}>
              <div className={styles.cardImg}>
                <BookOpen size={48} className={styles.cardImgIcon} aria-hidden="true" />
                <span className={styles.badge}>Próximamente</span>
              </div>
              <div className={styles.cardBody}>
                <p className={styles.cardCategory}>{category}</p>
                <h2 className={styles.cardTitle}>{title}</h2>
                <p className={styles.cardDesc}>{desc}</p>
                <p className={styles.cardFooter}>{readTime} de lectura</p>
              </div>
            </article>
          ))}
        </div>

        {/* Newsletter */}
        <div className={styles.newsletter}>
          <h2 className={styles.newsletterTitle}>Avísame cuando publiquen</h2>
          <p className={styles.newsletterSubtitle}>
            Sin spam. Solo artículos prácticos cuando estén listos.
          </p>
          <NewsletterForm />
        </div>
      </div>
    </section>
  )
}

function NewsletterForm() {
  return (
    <form className={styles.newsletterForm} action="https://formspree.io/f/activopos-blog" method="POST">
      <input
        type="email"
        name="email"
        className={styles.newsletterInput}
        placeholder="tu@correo.com"
        required
        autoComplete="email"
        aria-label="Correo electrónico"
      />
      <button type="submit" className={styles.newsletterBtn}>
        Notificarme
      </button>
    </form>
  )
}
