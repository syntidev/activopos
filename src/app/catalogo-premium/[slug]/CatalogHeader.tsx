'use client'

import { forwardRef } from 'react'
import Link from 'next/link'
import { Search, Info } from 'lucide-react'
import { CartHeaderButton } from './CartHeaderButton'
import { getInitials } from './catalogUtils'
import styles from './catalogo.module.css'

// Extraído de CatalogoGrid.tsx -- mismo componente, reusado en /kit-200k
// (sprint "header/footer reales") para que se sienta parte del mismo sitio.
// Puramente presentacional: el host controla isScrolled (cada host scrollea
// distinto -- CatalogoGrid usa .root como scroller propio, kit-200k usa el
// scroll normal del documento) y opcionalmente onSearchClick/onInfoClick.
// showIconCluster=false (kit-200k) oculta buscar/info/carrito -- esta página
// no tiene búsqueda de productos ni carrito real, mostrar esos botones ahí
// sería un botón sin función real (Cero Fachadas).
export interface CatalogHeaderProps {
  slug:            string
  businessName:    string
  businessLogo:    string | null
  businessCity:    string | null
  isScrolled:      boolean
  showIconCluster?: boolean
  onSearchClick?:  () => void
  onInfoClick?:    () => void
}

export const CatalogHeader = forwardRef<HTMLElement, CatalogHeaderProps>(function CatalogHeader(
  { slug, businessName, businessLogo, businessCity, isScrolled, showIconCluster = true, onSearchClick, onInfoClick },
  ref,
) {
  const initials = getInitials(businessName)

  return (
    <header ref={ref} className={`${styles.stickyHeader} ${isScrolled ? styles.stickyHeaderScrolled : ''}`}>
      <Link
        href={`/catalogo-premium/${slug}`}
        className={styles.headerLogo}
        aria-label={`Ir al inicio de ${businessName}`}
      >
        {businessLogo ? (
          <img src={businessLogo} alt={businessName} className={styles.headerLogoImg} />
        ) : (
          <span className={styles.headerLogoInitials} aria-hidden="true">{initials}</span>
        )}
        <span className={styles.headerInfo}>
          <span className={styles.headerNameRow}>
            <span className={styles.headerName}>{businessName}</span>
            <span className={styles.headerStatusDot} aria-label="Abierto" title="Abierto" />
          </span>
          {businessCity && <span className={styles.headerCity}>{businessCity}</span>}
        </span>
      </Link>

      <nav className={styles.headerNav} aria-label="Navegación principal">
        <Link href={`/catalogo-premium/${slug}`} className={styles.headerNavLink}>Inicio</Link>
        <Link href={`/catalogo-premium/${slug}/productos`} className={styles.headerNavLink}>Tienda</Link>
        {/* TEMPORAL — demo Gran Fondo 200K. Remover cuando no aplique el link
            público (o cuando el evento termine). */}
        <Link href="/kit-200k" className={styles.headerNavLink}>200K</Link>
        <Link
          href={`/catalogo-premium/${slug}#marcas`}
          className={styles.headerNavLink}
          onClick={(e) => {
            const target = document.getElementById('marcas')
            if (!target) return
            e.preventDefault()
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
          }}
        >
          Marcas
        </Link>
      </nav>

      {showIconCluster && (
        <div className={styles.iconCluster}>
          {onSearchClick && (
            <button type="button" className={styles.desktopSearchBtn} onClick={onSearchClick} aria-label="Buscar productos">
              <Search size={18} aria-hidden="true" />
            </button>
          )}
          {onInfoClick && (
            <button type="button" className={styles.infoBtn} onClick={onInfoClick} aria-label="Información del negocio">
              <Info size={20} aria-hidden="true" />
            </button>
          )}
          <CartHeaderButton />
        </div>
      )}
    </header>
  )
})
