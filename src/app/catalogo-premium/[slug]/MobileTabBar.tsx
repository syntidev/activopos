'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Home, Store, Search, ShoppingBag, User } from 'lucide-react'
import { useCart } from './CartContext'
import styles from './catalogo.module.css'

interface Props {
  slug:           string
  onSearchClick:  () => void
  onAccountClick: () => void
}

interface TabItem {
  key:     string
  label:   string
  Icon:    typeof Home
  active:  boolean
  onClick: () => void
  badge?:  number
}

// Fijo abajo, solo mobile (oculto vía CSS desde 1024px — ver .mobileTabBar).
// Inicio/Tienda navegan de verdad; Buscar/Cuenta reusan los overlays que ya
// existen en el header (setSearchExpanded/setInfoOpen, pasados por el padre)
// en vez de duplicar esa UI. Carrito reusa useCart() — mismo estado que
// CartHeaderButton, para que el badge nunca se desincronice entre los dos.
export function MobileTabBar({ slug, onSearchClick, onAccountClick }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const { totalItems, cartOpen, setCartOpen } = useCart()

  const homeHref   = `/catalogo-premium/${slug}`
  const tiendaHref = `/catalogo-premium/${slug}/productos`
  const isHome     = pathname === homeHref
  const isTienda   = pathname.startsWith(tiendaHref)

  const items: TabItem[] = [
    { key: 'inicio',  label: 'Inicio',  Icon: Home,       active: isHome,   onClick: () => router.push(homeHref) },
    { key: 'tienda',  label: 'Tienda',  Icon: Store,      active: isTienda, onClick: () => router.push(tiendaHref) },
    { key: 'buscar',  label: 'Buscar',  Icon: Search,     active: false,    onClick: onSearchClick },
    { key: 'carrito', label: 'Carrito', Icon: ShoppingBag, active: cartOpen, onClick: () => setCartOpen(true), badge: totalItems },
    { key: 'cuenta',  label: 'Cuenta',  Icon: User,       active: false,    onClick: onAccountClick },
  ]

  return (
    <nav className={styles.mobileTabBar} aria-label="Navegación móvil">
      {items.map(({ key, label, Icon, active, onClick, badge }) => (
        <button
          key={key}
          type="button"
          className={`${styles.mobileTabItem} ${active ? styles.mobileTabItemActive : ''}`}
          onClick={onClick}
          aria-current={active ? 'page' : undefined}
        >
          <span className={styles.mobileTabIconWrap}>
            <Icon
              size={22}
              aria-hidden="true"
              fill={active ? 'currentColor' : 'none'}
              strokeWidth={active ? 1.75 : 2}
            />
            {!!badge && badge > 0 && (
              <span className={styles.mobileTabBadge} aria-hidden="true">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </span>
          <span className={styles.mobileTabLabel}>{label}</span>
        </button>
      ))}
    </nav>
  )
}
