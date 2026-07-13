import Link from 'next/link'
import { Share2, MessageCircle, ExternalLink } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import styles from './MarketingFooter.module.css'

const PRODUCT_LINKS = [
  { label: '¿Para quién?',   href: '/#segmentos' },
  { label: 'Cómo funciona',  href: '/#ecosystem' },
  { label: 'Planes',         href: '/planes' },
  { label: 'Recursos',       href: '/recursos' },
  { label: 'Blog',           href: '/blog' },
  { label: 'Demo',           href: 'https://wa.me/584222654827?text=Quiero+ver+una+demo+de+ActivoPOS' },
]

const COMPANY_LINKS = [
  { label: 'Nosotros',  href: '/nosotros' },
  { label: 'Contacto',  href: '/contacto' },
  { label: 'Ayuda',     href: '/soporte' },
]

const LEGAL_LINKS = [
  { label: 'Política de Privacidad', href: '/privacidad' },
  { label: 'Términos y Condiciones', href: '/terminos' },
]

export default async function MarketingFooter() {
  const segments = await prisma.segment.findMany({
    where:   { active: true },
    orderBy: { sort_order: 'asc' },
    select:  { slug: true, name: true },
  })

  return (
    <footer className={styles.footer}>
      <div className={styles.grid}>

        {/* Brand col */}
        <div className={styles.brand}>
          <Link href="/" className={styles.logo} aria-label="ActivoPOS — inicio">
            <img src="/activopos-logo-flat-positive.svg" alt="" aria-hidden="true" className={styles.logoImg} />
            <span className={styles.logoName}>
              <span className={styles.logoA}>Activo</span>
              <span className={styles.logoB}>POS</span>
            </span>
          </Link>
          <p className={styles.tagline}>El POS para negocios que andan activos.</p>
          <p className={styles.copy}>
            Sistema de control de ventas e inventario diseñado nativamente para Venezuela.
            No reemplaza tu facturación SENIAT — la complementa.
          </p>
          <div className={styles.social}>
            <a
              href="https://instagram.com/activopos"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialLink}
              aria-label="Instagram de ActivoPOS"
            >
              <Share2 size={13} aria-hidden="true"/>
              Instagram
            </a>
            <a
              href="https://wa.me/584222654827"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialLink}
              aria-label="WhatsApp de ActivoPOS"
            >
              <MessageCircle size={13} aria-hidden="true"/>
              WhatsApp
            </a>
          </div>
          <a
            href="https://synti.dev"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.syntiLink}
          >
            Parte del ecosistema synti.dev
            <ExternalLink size={10} aria-hidden="true"/>
          </a>
        </div>

        {/* Producto col */}
        <div className={styles.col}>
          <p className={styles.colTitle}>Producto</p>
          <nav className={styles.colLinks}>
            {PRODUCT_LINKS.map(({ label, href }) => (
              <Link key={href} href={href} className={styles.colLink}>
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Segmentos col */}
        <div className={styles.col}>
          <p className={styles.colTitle}>Segmentos</p>
          <nav className={styles.colLinks}>
            {segments.slice(0, 6).map(seg => (
              <Link key={seg.slug} href={`/para-${seg.slug}`} className={styles.colLink}>
                {seg.name}
              </Link>
            ))}
            {segments.length > 6 && (
              <Link href="/segmentos" className={styles.colLink}>
                Ver todos →
              </Link>
            )}
          </nav>
        </div>

        {/* Empresa + Legal col */}
        <div className={styles.col}>
          <p className={styles.colTitle}>Empresa</p>
          <nav className={styles.colLinks}>
            {COMPANY_LINKS.map(({ label, href }) => (
              <Link key={href} href={href} className={styles.colLink}>
                {label}
              </Link>
            ))}
          </nav>

          <div className={styles.colDivider} aria-hidden="true"/>

          <p className={styles.colTitle}>Legal</p>
          <nav className={styles.colLinks}>
            {LEGAL_LINKS.map(({ label, href }) => (
              <Link key={href} href={href} className={styles.colLink}>
                {label}
              </Link>
            ))}
          </nav>
          <a href="mailto:hola@activopos.com" className={styles.emailLink}>
            hola@activopos.com
          </a>
        </div>
      </div>

      <div className={styles.wordmarkBlock}>
        <div className={styles.wordmarkDivider} aria-hidden="true" />
        <span className={styles.wordmark} aria-hidden="true">
          <span className={styles.wordmarkActivo}>Activo</span>
          <span className={styles.wordmarkPos}>POS</span>
        </span>
        <div className={styles.wordmarkFade} aria-hidden="true" />
      </div>

      <div className={styles.bottom}>
        <p className={styles.bottomLeft}>
          © 2026 ActivoPOS · activopos.com
        </p>
        <p className={styles.bottomRight}>
          Hecho con ♥ en Venezuela ·{' '}
          <a href="https://synti.dev" target="_blank" rel="noopener noreferrer">
            synti.dev
          </a>
        </p>
      </div>
    </footer>
  )
}
