'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import styles from './MarketingNav.module.css'

const NAV_LINKS = [
  { label: '¿Para quién?',  href: '/#segmentos' },
  { label: 'Cómo funciona', href: '/#ecosystem' },
  { label: 'Planes',        href: '/#pricing' },
  { label: 'Blog',          href: '/blog' },
  { label: 'Contacto',      href: '/contacto' },
]

export default function MarketingNav() {
  const [scrolled, setScrolled]   = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* lock body scroll when drawer open */
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const close = useCallback(() => setMenuOpen(false), [])

  return (
    <>
      <nav
        className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}
        aria-label="Navegación principal"
      >
        <Link href="/" className={styles.logo} onClick={close} aria-label="ActivoPOS — inicio">
          <span className={styles.logoA}>Activo</span>
          <span className={styles.logoB}>POS</span>
        </Link>

        <div className={styles.links} role="list">
          {NAV_LINKS.map(({ label, href }) => (
            <Link key={href} href={href} className={styles.link} role="listitem">
              {label}
            </Link>
          ))}
        </div>

        <div className={styles.actions}>
          <Link href="/login" className={styles.loginLink}>
            Iniciar sesión
          </Link>
          <Link href="/login" className={styles.ctaBtn}>
            Ingresar →
          </Link>
        </div>

        <button
          className={styles.menuBtn}
          onClick={() => setMenuOpen(o => !o)}
          aria-expanded={menuOpen}
          aria-controls="mobile-drawer"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {menuOpen ? <X size={18} aria-hidden="true"/> : <Menu size={18} aria-hidden="true"/>}
        </button>
      </nav>

      {/* Mobile drawer */}
      <div
        id="mobile-drawer"
        className={`${styles.drawer} ${menuOpen ? styles.drawerOpen : ''}`}
        aria-hidden={!menuOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
      >
        <div className={styles.overlay} onClick={close} aria-hidden="true"/>
        <div className={styles.drawerPanel}>
          <div className={styles.drawerHeader}>
            <Link href="/" className={styles.drawerLogo} onClick={close}>
              <span className={styles.logoA}>Activo</span>
              <span className={styles.logoB}>POS</span>
            </Link>
            <button className={styles.closeBtn} onClick={close} aria-label="Cerrar menú">
              <X size={18} aria-hidden="true"/>
            </button>
          </div>

          <nav className={styles.drawerLinks}>
            {NAV_LINKS.map(({ label, href }) => (
              <Link key={href} href={href} className={styles.drawerLink} onClick={close}>
                {label}
              </Link>
            ))}
          </nav>

          <div className={styles.drawerDivider} aria-hidden="true"/>

          <div className={styles.drawerActions}>
            <Link href="/login" className={styles.drawerLoginLink} onClick={close}>
              Iniciar sesión
            </Link>
            <Link href="/login" className={styles.drawerCta} onClick={close}>
              Ingresar →
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
