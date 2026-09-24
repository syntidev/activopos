import { Children, type CSSProperties, type ReactNode } from 'react'
import styles from './AdaptiveGrid.module.css'

/*
 * AdaptiveGrid — REGLA SELLADA: toda sección que muestre una lista de
 * productos (o de categorías) en el catálogo usa este componente. Ninguna
 * sección define su propio grid/carrusel de productos (ver CLAUDE.md).
 *
 * Criterio estándar para "pocos productos" (nunca queda un hueco a un lado):
 *   1. Columnas efectivas = min(N productos, máximo de columnas del breakpoint).
 *      Con menos productos que el máximo, cada card se ensancha para llenar la fila.
 *   2. El ensanche tiene techo: 1.5× el ancho natural de una card (el que tendría
 *      con la fila llena), para que 1 producto no sea una card gigante. Si con el
 *      techo no alcanza a llenar la fila, el contenido se CENTRA (espacio simétrico).
 *   3. La última fila incompleta (ej. 5 productos en 4 columnas) también se centra.
 * Todo es CSS (flex-wrap + custom properties); N solo se lee para las columnas.
 */

export interface AdaptiveGridProps {
  children:    ReactNode
  /** Máximo de columnas por breakpoint: móvil (<640), tablet (640-1023), desktop (≥1024). */
  max?:        { mobile: number; tablet: number; desktop: number }
  /** Centra cards de ancho fijo (ej. círculos de categoría) dentro de su celda. */
  centerItems?: boolean
  className?:  string
}

const DEFAULT_MAX = { mobile: 2, tablet: 3, desktop: 4 }

export function AdaptiveGrid({ children, max = DEFAULT_MAX, centerItems = false, className }: AdaptiveGridProps) {
  const items = Children.toArray(children)
  // Custom properties dinámicas (N y máximos) -- el layout vive en el .module.css.
  const vars = {
    '--ag-n': items.length,
    '--ag-m': max.mobile,
    '--ag-t': max.tablet,
    '--ag-d': max.desktop,
  } as CSSProperties
  return (
    <div className={[styles.grid, className].filter(Boolean).join(' ')} style={vars}>
      {items.map((child, i) => (
        <div key={i} className={centerItems ? `${styles.cell} ${styles.cellCenter}` : styles.cell}>
          {child}
        </div>
      ))}
    </div>
  )
}
