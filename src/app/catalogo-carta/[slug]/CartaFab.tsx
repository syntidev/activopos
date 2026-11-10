'use client'

import { useEffect, useRef } from 'react'
import { ShoppingBag } from 'lucide-react'
import { useCart } from '@/app/catalogo-premium/[slug]/CartContext'
import { cx, fmtBs, fmtUsd } from './util'
import styles from './carta.module.css'

interface CartaFabProps {
  rate: number
}

/** Barra fija "Ver mi pedido": cantidad y total en $ y Bs siempre visibles (375 y 1280). */
export function CartaFab({ rate }: CartaFabProps) {
  const { totalItems, subtotalUsd, setCartOpen, cartBumping } = useCart()
  const fabRef = useRef<HTMLButtonElement>(null)

  // Alto real de la barra "Mi pedido" (+ su separación del borde) → --carta-fab-h: la lista deja ese espacio al final.
  useEffect(() => {
    const root = document.documentElement
    const fab = fabRef.current
    if (!fab) { root.style.setProperty('--carta-fab-h', '0px'); return }
    const medir = (): void => { root.style.setProperty('--carta-fab-h', (fab.offsetHeight + parseFloat(getComputedStyle(fab).bottom || '0')) + 'px') }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(fab)
    return () => { ro.disconnect(); root.style.setProperty('--carta-fab-h', '0px') }
  }, [totalItems])
  if (totalItems === 0) return null // aparece al agregar el primer plato
  return (
    <button type="button" ref={fabRef} className={styles.fab} onClick={() => setCartOpen(true)} data-testid="carta-barra-pedido"
      aria-label={totalItems === 0 ? 'Mi pedido, vacío' : 'Ver mi pedido, ' + totalItems + (totalItems === 1 ? ' plato' : ' platos')}>
      <span className={styles.fabIco}>
        <ShoppingBag size={20} aria-hidden="true" />
        <b className={cx(styles.fabCnt, cartBumping && styles.fabBump)} data-testid="carta-barra-cantidad">{totalItems}</b>
      </span>
      <span className={styles.fabLbl}>{totalItems === 0 ? 'Mi pedido' : 'Ver mi pedido'}</span>
      <span className={styles.fabTot}>
        <b data-testid="carta-barra-total-usd">{fmtUsd(subtotalUsd)}</b>
        <small data-testid="carta-barra-total-bs">{fmtBs(subtotalUsd * rate)}</small>
      </span>
    </button>
  )
}
