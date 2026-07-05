'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown, Clock, Minus, Pencil, Percent, Plus,
  ShoppingCart, Tag, Trash2, User,
} from 'lucide-react'
import { Button } from '@/components/ui'
import type { TicketItem, TicketState, TicketTotals } from '@/lib/pos'
import styles from './pos.module.css'

interface TicketPanelProps {
  ticket: TicketState
  totals: TicketTotals
  isEmpty: boolean
  onUpdateQty: (id: number, qty: number) => void
  onRemove: (id: number) => void
  onClear: () => void
  onSelectClient: () => void
  onProcesarPago: () => void
  onVenderCredito: () => void
  onCotizar: () => void
  onDescuento: () => void
  onCargo: () => void
  userRole: 'admin' | 'super_admin' | 'cashier'
  onPriceOverride: (productId: number, variantId: number | undefined, newPrice: number, reason?: string, pin?: string) => void
  allowCashierPriceOverride?: boolean
  pendingSaleActive?: boolean
}

export function TicketPanel({
  ticket, totals, isEmpty,
  onUpdateQty, onRemove, onClear, onSelectClient,
  onProcesarPago, onVenderCredito, onCotizar, onDescuento, onCargo,
  userRole, onPriceOverride, allowCashierPriceOverride, pendingSaleActive,
}: TicketPanelProps) {
  const router = useRouter()
  const { discount_global_pct: discountPct, cargo_global_pct: cargoPct } = ticket

  return (
    <div className={styles.rightPanel}>
      {/* Header */}
      <div className={styles.ticketHeader}>
        <button className={styles.clienteBtn} onClick={onSelectClient} aria-label="Seleccionar cliente">
          <User size={15} aria-hidden="true" />
          <span>{ticket.client_name || 'Cliente General'}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        <div className={styles.ticketActions}>
          <button className={styles.ticketIconBtn} onClick={() => router.push('/reportes')} aria-label="Historial" title="Historial de ventas">
            <Clock size={16} aria-hidden="true" />
          </button>
          <button
            className={styles.ticketIconBtn}
            onClick={onClear}
            aria-label="Vaciar ticket"
            disabled={isEmpty}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={styles.ticketDivider} />

      {/* Items */}
      <div className={styles.ticketItems}>
        {isEmpty ? (
          <motion.div
            className={styles.ticketEmpty}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <ShoppingCart size={36} strokeWidth={1} aria-hidden="true" />
            <p className={styles.ticketEmptyTitle}>Ticket vacío</p>
            <p className={styles.ticketEmptySubtitle}>Toca un producto para agregarlo</p>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {ticket.items.map((item) => (
              <TicketItemRow
                key={`${item.product_id}-${item.variant_id ?? 'base'}`}
                item={item}
                onUpdateQty={onUpdateQty}
                onRemove={onRemove}
                userRole={userRole}
                onPriceOverride={onPriceOverride}
                allowCashierPriceOverride={allowCashierPriceOverride}
                pendingSaleActive={pendingSaleActive}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Totals */}
      <div className={styles.ticketTotals}>
        {(discountPct > 0 || cargoPct > 0 || ticket.iva_pct > 0) && (
          <div className={styles.totalBreakdown}>
            <div className={styles.totalRow}>
              <span>Subtotal</span>
              <span>${totals.subtotal_usd.toFixed(2)}</span>
            </div>
            {discountPct > 0 && (
              <div className={`${styles.totalRow} ${styles.totalRowDiscount}`}>
                <span>Descuento ({discountPct}%)</span>
                <span>-${totals.discount_usd.toFixed(2)}</span>
              </div>
            )}
            {cargoPct > 0 && (
              <div className={`${styles.totalRow} ${styles.totalRowCargo}`}>
                <span>Cargo ({cargoPct}%)</span>
                <span>+${totals.cargo_usd.toFixed(2)}</span>
              </div>
            )}
            {ticket.iva_pct > 0 && (
              <div className={`${styles.totalRow} ${styles.totalRowIva}`}>
                <span>IVA ({ticket.iva_pct}%)</span>
                <span>+${totals.iva_usd.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
        <div className={styles.totalMain}>
          <div className={styles.totalMainRow}>
            <span className={styles.totalUsdLabel}>TOTAL USD</span>
            <span className={styles.totalUsdValue}>${totals.total_usd.toFixed(2)}</span>
          </div>
          <div className={styles.totalBsRow}>
            <span className={styles.totalBsLabel}>En Bs. (@ {ticket.rate.toFixed(2)})</span>
            <span className={styles.totalBsValue}>
              Bs.&nbsp;{totals.total_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.ticketActionArea}>
        <Button variant="cta" fullWidth size="lg" onClick={onProcesarPago} disabled={isEmpty}>
          Procesar Pago
        </Button>
        <Button variant="secondary" fullWidth onClick={onVenderCredito} disabled={isEmpty}>
          Venta a Crédito
        </Button>
        <Button variant="ghost" fullWidth onClick={onCotizar} disabled={isEmpty}>
          Generar Cotización
        </Button>
        <div className={styles.ticketFooter}>
          <button className={styles.footerBtn} onClick={onDescuento} disabled={isEmpty} type="button">
            <Tag size={14} aria-hidden="true" />
            <span>Descuento</span>
            {discountPct > 0 && <span className={styles.footerBadge}>{discountPct}%</span>}
          </button>
          <button className={styles.footerBtn} onClick={onCargo} disabled={isEmpty} type="button">
            <Percent size={14} aria-hidden="true" />
            <span>Cargo</span>
            {cargoPct > 0 && <span className={styles.footerBadge}>{cargoPct}%</span>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TicketItemRow ──────────────────────────────────────────────────────────────

interface RowProps {
  item: TicketItem
  onUpdateQty: (id: number, qty: number) => void
  onRemove: (id: number) => void
  userRole: 'admin' | 'super_admin' | 'cashier'
  onPriceOverride: (productId: number, variantId: number | undefined, newPrice: number, reason?: string, pin?: string) => void
  allowCashierPriceOverride?: boolean
  pendingSaleActive?: boolean
}

function TicketItemRow({ item, onUpdateQty, onRemove, userRole, onPriceOverride, allowCashierPriceOverride, pendingSaleActive }: RowProps) {
  const qtyStep = item.sale_mode === 'weight' ? 0.1 : 1
  const net     = item.subtotal_usd - item.discount_usd

  const [editOpen, setEditOpen]       = useState(false)
  const [editStep, setEditStep]       = useState<'price' | 'pin'>('price')
  const [newPrice, setNewPrice]       = useState('')
  const [reason, setReason]           = useState('')
  const [pin, setPin]                 = useState(['', '', '', ''])
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError]     = useState('')
  const [popPos, setPopPos]           = useState({ top: 0, left: 0 })
  const [mounted, setMounted]         = useState(false)

  const pencilRef = useRef<HTMLButtonElement>(null)
  const priceRef  = useRef<HTMLInputElement>(null)
  const pin0Ref   = useRef<HTMLInputElement>(null)
  const pin1Ref   = useRef<HTMLInputElement>(null)
  const pin2Ref   = useRef<HTMLInputElement>(null)
  const pin3Ref   = useRef<HTMLInputElement>(null)
  const pinRefs   = [pin0Ref, pin1Ref, pin2Ref, pin3Ref]

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!editOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editOpen])

  const openEdit = () => {
    if (pendingSaleActive) return // venta ya registrada en DB — precio fijado
    const rect  = pencilRef.current?.getBoundingClientRect()
    const width = 292
    if (rect) {
      const left = Math.min(rect.left, window.innerWidth - width - 8)
      setPopPos({ top: rect.bottom + 6, left: Math.max(8, left) })
    }
    setNewPrice(item.price_per_unit_usd.toFixed(2))
    setReason(item.override_reason ?? '')
    setPin(['', '', '', ''])
    setEditError('')
    setEditStep('price')
    setEditOpen(true)
    setTimeout(() => priceRef.current?.select(), 40)
  }

  const handleSavePrice = () => {
    const parsed = parseFloat(newPrice)
    if (isNaN(parsed) || parsed <= 0) { setEditError('Ingresa un precio válido mayor a 0'); return }
    if (userRole === 'cashier' && !allowCashierPriceOverride) {
      setEditStep('pin')
      setEditError('')
      setTimeout(() => pin0Ref.current?.focus(), 40)
      return
    }
    void applyOverride(parsed, undefined)
  }

  const applyOverride = async (price: number, pinStr: string | undefined) => {
    setEditLoading(true)
    setEditError('')
    try {
      if (pinStr !== undefined) {
        // ponytail: stub — wires to CLI-A endpoint PATCH /api/sales/items/price-override
        const res = await fetch('/api/sales/items/price-override', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            product_id:          item.product_id,
            variant_id:          item.variant_id,
            unit_price_override: price,
            override_reason:     reason || undefined,
            pin:                 pinStr,
          }),
        }).catch(() => null)

        if (res && !res.ok && res.status !== 404) {
          const data = await res.json().catch(() => ({})) as { error?: string }
          setEditError(data.error ?? 'PIN incorrecto. Intenta de nuevo.')
          setPin(['', '', '', ''])
          setTimeout(() => pin0Ref.current?.focus(), 40)
          setEditLoading(false)
          return
        }
      }
      onPriceOverride(item.product_id, item.variant_id, price, reason || undefined, pinStr)
      setEditOpen(false)
    } finally {
      setEditLoading(false)
    }
  }

  const handlePinConfirm = () => {
    const pinStr = pin.join('')
    if (pinStr.length < 4) { setEditError('Ingresa los 4 dígitos del PIN'); return }
    void applyOverride(parseFloat(newPrice), pinStr)
  }

  const handlePinChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next  = [...pin]
    next[idx]   = digit
    setPin(next)
    if (digit && idx < 3) pinRefs[idx + 1].current?.focus()
  }

  const handlePinKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) pinRefs[idx - 1].current?.focus()
    if (e.key === 'Enter' && pin.every(d => d !== '')) handlePinConfirm()
  }

  const pinFull = pin.every(d => d !== '')

  const popover = editOpen && mounted && createPortal(
    <>
      <div className={styles.popoverBackdrop} onClick={() => setEditOpen(false)} />
      <div
        className={styles.pricePopover}
        style={{ top: popPos.top, left: popPos.left }}
        role="dialog"
        aria-label="Editar precio"
      >
        <p className={styles.popoverTitle}>
          {editStep === 'price' ? 'Editar precio' : 'Autorización requerida'}
        </p>

        {editStep === 'price' && (
          <>
            <div className={styles.popoverPriceRow}>
              <span className={styles.popoverCurrency}>$</span>
              <input
                ref={priceRef}
                type="number"
                className={styles.popoverPriceInput}
                value={newPrice}
                onChange={e => setNewPrice(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSavePrice() }}
                min="0.01"
                step="0.01"
                aria-label="Nuevo precio en USD"
              />
              <span className={styles.popoverUnit}>/{item.unit_label}</span>
            </div>
            <input
              type="text"
              className={styles.popoverReasonInput}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Motivo (opcional)"
              maxLength={120}
              aria-label="Motivo del cambio de precio"
            />
          </>
        )}

        {editStep === 'pin' && (
          <div className={styles.popoverPinSection}>
            <p className={styles.popoverPinHint}>PIN de administrador (4 dígitos)</p>
            <div className={styles.popoverPinBoxes}>
              {pin.map((d, i) => (
                <input
                  key={i}
                  ref={pinRefs[i]}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  className={`${styles.popoverPinBox}${editError ? ` ${styles.popoverPinBoxError}` : ''}`}
                  value={d}
                  onChange={e => handlePinChange(i, e.target.value)}
                  onKeyDown={e => handlePinKeyDown(i, e)}
                  aria-label={`Dígito ${i + 1} del PIN`}
                  disabled={editLoading}
                />
              ))}
            </div>
          </div>
        )}

        {editError && <p className={styles.popoverError}>{editError}</p>}

        <div className={styles.popoverActions}>
          <button
            type="button"
            className={styles.popoverCancel}
            onClick={() => {
              if (editStep === 'pin') { setEditStep('price'); setEditError('') }
              else setEditOpen(false)
            }}
            disabled={editLoading}
          >
            {editStep === 'pin' ? 'Atrás' : 'Cancelar'}
          </button>
          <button
            type="button"
            className={styles.popoverSave}
            onClick={editStep === 'price' ? handleSavePrice : handlePinConfirm}
            disabled={editLoading || (editStep === 'pin' && !pinFull)}
          >
            {editLoading ? 'Guardando…' : editStep === 'pin' ? 'Confirmar' : 'Guardar'}
          </button>
        </div>
      </div>
    </>,
    document.body
  )

  return (
    <>
      <motion.div
        className={styles.ticketItem}
        initial={{ opacity: 0, x: 16, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -12, scale: 0.96, height: 0, marginBottom: 0 }}
        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className={styles.itemInfo}>
          <span className={styles.itemName}>{item.product_name}</span>
          <span className={styles.itemPrice}>
            {item.price_override_original != null ? (
              <>
                <span className={styles.itemPriceOriginal}>
                  ${item.price_override_original.toFixed(2)}/{item.unit_label}
                </span>
                <span className={styles.itemPriceOverride}>
                  ${item.price_per_unit_usd.toFixed(2)}/{item.unit_label}
                </span>
              </>
            ) : (
              <>${item.price_per_unit_usd.toFixed(2)}/{item.unit_label}</>
            )}
            <button
              ref={pencilRef}
              type="button"
              className={styles.priceEditBtn}
              onClick={openEdit}
              disabled={pendingSaleActive}
              aria-label={`Editar precio de ${item.product_name}`}
              title={pendingSaleActive ? 'Precio fijado — reinicia la venta para cambiar' : 'Editar precio'}
            >
              <Pencil size={11} aria-hidden="true" />
            </button>
          </span>
        </div>
        <div className={styles.itemControls}>
          <div className={styles.qtyControl}>
            <button
              className={styles.qtyBtn}
              onClick={() => onUpdateQty(item.product_id, item.quantity - qtyStep)}
              aria-label="Reducir cantidad"
              type="button"
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <span className={styles.qtyValue}>
              {item.sale_mode === 'weight'
                ? item.quantity.toFixed(3) + ' ' + item.unit_label
                : item.quantity + ' ' + item.unit_label}
            </span>
            <button
              className={styles.qtyBtn}
              onClick={() => onUpdateQty(item.product_id, item.quantity + qtyStep)}
              aria-label="Aumentar cantidad"
              type="button"
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>
          <div className={styles.itemSubtotal}>
            <span className={styles.itemSubUsd}>${net.toFixed(2)}</span>
            <span className={styles.itemSubBs}>
              Bs.&nbsp;{(net * item.rate_used).toFixed(2)}
            </span>
          </div>
          <button
            className={styles.removeBtn}
            onClick={() => onRemove(item.product_id)}
            aria-label={`Eliminar ${item.product_name}`}
            type="button"
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
        {item.sale_mode === 'weight' && (
          <div className={styles.weightPreview}>
            {item.quantity.toFixed(3)}&nbsp;{item.unit_label}&nbsp;&times;&nbsp;
            ${item.price_per_unit_usd.toFixed(2)}/{item.unit_label}
            &nbsp;=&nbsp;<strong>${(item.quantity * item.price_per_unit_usd).toFixed(2)}</strong>
          </div>
        )}
      </motion.div>

      {popover}
    </>
  )
}
