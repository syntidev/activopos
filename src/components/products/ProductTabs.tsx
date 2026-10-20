'use client'

import { useEffect, useRef } from 'react'
import styles from './ProductTabs.module.css'

export type ProductTabId = 'basico' | 'precio' | 'inventario' | 'imagenes' | 'catalogo' | 'avanzado'

export const PRODUCT_TABS: ReadonlyArray<{ id: ProductTabId; label: string }> = [
  { id: 'basico',     label: 'Básico' },
  { id: 'precio',     label: 'Precio' },
  { id: 'inventario', label: 'Inventario y variantes' },
  { id: 'imagenes',   label: 'Imágenes' },
  { id: 'catalogo',   label: 'Catálogo' },
  { id: 'avanzado',   label: 'Avanzado' },
]

interface ProductTabBarProps {
  active: ProductTabId
  onChange: (id: ProductTabId) => void
  /** Pestañas con campos inválidos: muestran un punto rojo. */
  errors: Readonly<Record<ProductTabId, boolean>>
}

export const tabButtonId = (id: ProductTabId) => `ptab-${id}`
export const tabPanelId = (id: ProductTabId) => `ppanel-${id}`

/**
 * Barra de pestañas fija arriba (sticky dentro del formulario). Patrón WAI-ARIA tabs:
 * flechas/Inicio/Fin mueven el foco entre pestañas; Tab sale directo al panel activo.
 */
export function ProductTabBar({ active, onChange, errors }: ProductTabBarProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  // En móvil la barra hace scroll horizontal: la pestaña activa (p. ej. tras un salto por error) debe quedar visible.
  useEffect(() => {
    refs.current[active]?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [active])

  const move = (index: number) => {
    const next = PRODUCT_TABS[(index + PRODUCT_TABS.length) % PRODUCT_TABS.length]
    onChange(next.id)
    refs.current[next.id]?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); move(index + 1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); move(index - 1) }
    else if (e.key === 'Home') { e.preventDefault(); move(0) }
    else if (e.key === 'End') { e.preventDefault(); move(PRODUCT_TABS.length - 1) }
  }

  return (
    <div className={styles.bar}>
      <div className={styles.list} role="tablist" aria-label="Secciones del producto">
        {PRODUCT_TABS.map((t, i) => {
          const on = t.id === active
          return (
            <button
              key={t.id}
              ref={el => { refs.current[t.id] = el }}
              type="button"
              role="tab"
              id={tabButtonId(t.id)}
              aria-selected={on}
              aria-controls={tabPanelId(t.id)}
              tabIndex={on ? 0 : -1}
              className={`${styles.tab} ${on ? styles.tabActive : ''}`}
              onClick={() => onChange(t.id)}
              onKeyDown={e => onKeyDown(e, i)}
            >
              {t.label}
              {errors[t.id] && (
                <>
                  <span className={styles.dot} aria-hidden="true" />
                  <span className={styles.srOnly}> (tiene campos por corregir)</span>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
