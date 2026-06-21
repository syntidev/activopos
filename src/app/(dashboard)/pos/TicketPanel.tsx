'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown, Clock, Minus, Percent, Plus,
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
}

export function TicketPanel({
  ticket, totals, isEmpty,
  onUpdateQty, onRemove, onClear, onSelectClient,
  onProcesarPago, onVenderCredito, onCotizar, onDescuento, onCargo,
}: TicketPanelProps) {
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
          <button className={styles.ticketIconBtn} aria-label="Historial" title="Historial de ventas">
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
                key={item.product_id}
                item={item}
                onUpdateQty={onUpdateQty}
                onRemove={onRemove}
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

interface RowProps {
  item: TicketItem
  onUpdateQty: (id: number, qty: number) => void
  onRemove: (id: number) => void
}

function TicketItemRow({ item, onUpdateQty, onRemove }: RowProps) {
  const step = item.sale_mode === 'weight' ? 0.1 : 1
  const net = item.subtotal_usd - item.discount_usd

  return (
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
          ${item.price_per_unit_usd.toFixed(2)}/{item.unit_label}
        </span>
      </div>
      <div className={styles.itemControls}>
        <div className={styles.qtyControl}>
          <button
            className={styles.qtyBtn}
            onClick={() => onUpdateQty(item.product_id, item.quantity - step)}
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
            onClick={() => onUpdateQty(item.product_id, item.quantity + step)}
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
  )
}
