'use client'

import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { ChevronDown, CreditCard, FileText, MoreHorizontal, Percent, Printer, Tag, User, X } from 'lucide-react'
import { Button } from '@/components/ui'
import styles from './MobileTicketSheet.module.css'

/** Distancia de arrastre hacia abajo (px) que cierra la hoja. */
const SWIPE_CLOSE_PX = 80

interface MobileTicketSheetProps {
  tabsSlot: ReactNode
  priceNode: ReactNode
  linesNode: ReactNode
  financingNode: ReactNode
  breakdownNode: ReactNode
  totalNode: ReactNode
  casheaNotes: ReactNode
  clientName: string | null | undefined
  discountPct: number
  cargoPct: number
  isEmpty: boolean
  cobroBlocked: boolean
  onClose?: () => void
  onSelectClient: () => void
  onProcesarPago: () => void
  onVenderCredito: () => void
  onCotizar: () => void
  onDescuento: () => void
  onCargo: () => void
  onImprimirCuenta: () => void
}

/**
 * Hoja del ticket para móvil (< 768 px): solo layout. Toda la lógica (precios, cobro, descuento)
 * llega por props desde TicketPanel/page, igual que en el panel de escritorio.
 */
export function MobileTicketSheet({
  tabsSlot, priceNode, linesNode, financingNode, breakdownNode, totalNode, casheaNotes,
  clientName, discountPct, cargoPct, isEmpty, cobroBlocked,
  onClose, onSelectClient, onProcesarPago, onVenderCredito, onCotizar, onDescuento, onCargo, onImprimirCuenta,
}: MobileTicketSheetProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const touchStartY = useRef<number | null>(null)

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [moreOpen])

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => { touchStartY.current = e.touches[0].clientY }
  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const start = touchStartY.current
    touchStartY.current = null
    if (start !== null && e.changedTouches[0].clientY - start > SWIPE_CLOSE_PX) onClose?.()
  }

  const pick = (action: () => void) => () => { setMoreOpen(false); action() }

  return (
    <div className={styles.sheet} data-testid="pos-sheet">
      <div className={styles.header} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <span className={styles.handle} aria-hidden="true" />
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Ticket</h2>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.moreBtn}
              onClick={() => setMoreOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
            >
              <MoreHorizontal size={18} aria-hidden="true" />
              <span>Más</span>
            </button>
            <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Cerrar ticket">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {moreOpen && (
        <>
          <button type="button" className={styles.menuBackdrop} onClick={() => setMoreOpen(false)} aria-label="Cerrar menú" />
          <div className={styles.menu} role="menu" aria-label="Más acciones del ticket">
            <button type="button" role="menuitem" className={styles.menuItem} onClick={pick(onSelectClient)}>
              <User size={18} aria-hidden="true" />
              <span className={styles.menuLabel}>Cliente</span>
              <span className={styles.menuValue}>{clientName || 'General'}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            <button type="button" role="menuitem" className={styles.menuItem} onClick={pick(onDescuento)} disabled={isEmpty}>
              <Tag size={18} aria-hidden="true" />
              <span className={styles.menuLabel}>Descuento</span>
              {discountPct > 0 && <span className={styles.menuBadge}>{discountPct}%</span>}
            </button>
            <button type="button" role="menuitem" className={styles.menuItem} onClick={pick(onCargo)} disabled={isEmpty}>
              <Percent size={18} aria-hidden="true" />
              <span className={styles.menuLabel}>Cargo</span>
              {cargoPct > 0 && <span className={styles.menuBadge}>{cargoPct}%</span>}
            </button>
            <button type="button" role="menuitem" className={styles.menuItem} onClick={pick(onVenderCredito)} disabled={isEmpty}>
              <CreditCard size={18} aria-hidden="true" />
              <span className={styles.menuLabel}>Venta a crédito</span>
            </button>
            <button type="button" role="menuitem" className={styles.menuItem} onClick={pick(onCotizar)} disabled={isEmpty}>
              <FileText size={18} aria-hidden="true" />
              <span className={styles.menuLabel}>Generar cotización</span>
            </button>
            <button type="button" role="menuitem" className={styles.menuItem} onClick={pick(onImprimirCuenta)} disabled={isEmpty}>
              <Printer size={18} aria-hidden="true" />
              <span className={styles.menuLabel}>Imprimir cuenta</span>
            </button>
          </div>
        </>
      )}

      <div className={styles.tabs}>{tabsSlot}</div>
      <div className={styles.mode}>{priceNode}</div>

      <div className={styles.lines}>
        {linesNode}
        <div className={styles.extras}>{financingNode}</div>
      </div>

      <div className={styles.footer}>
        {casheaNotes}
        {breakdownNode}
        {totalNode}
        <Button variant="cta" fullWidth size="lg" onClick={onProcesarPago} disabled={isEmpty || cobroBlocked}>
          Procesar Pago
        </Button>
      </div>
    </div>
  )
}
