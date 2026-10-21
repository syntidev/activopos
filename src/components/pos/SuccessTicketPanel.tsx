'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Printer, MessageCircle, ArrowRight, X } from 'lucide-react'
import styles from './SuccessTicketPanel.module.css'
import { buildWhatsAppMessage, whatsappPickChatUrl } from '@/lib/whatsapp-message'
import { PriceModeSwitch } from './PriceModeSwitch'
import type { PriceMode } from '@/lib/pos'

type PosMode = 'ticket' | 'invoice'

export interface SaleItemForPanel {
  name:      string
  qty:       number
  price_usd: number
}

export interface SaleSummary {
  id:             number
  ticket_number:  string
  status:         'paid' | 'pending' | 'quote' | 'credit'
  total_usd:      number
  total_bs:       number
  due_date:       string | null
  payment_method: string
  rate:           number
  items:          SaleItemForPanel[]
  /** Modo de precio con el que se cobró; se muestra en solo lectura. */
  price_mode?:    PriceMode
}

interface Props {
  sale:         SaleSummary
  businessName: string
  onClose:      () => void
}

function buildWhatsappMessage(sale: SaleSummary, businessName: string): string {
  const isCredit = sale.status === 'credit'
  const due = sale.due_date
    ? new Date(sale.due_date + 'T00:00:00').toLocaleDateString('es-VE', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : null

  return buildWhatsAppMessage({
    kind:          'comprobante',
    audience:      'client',
    businessName,
    orderNumber:   sale.ticket_number,
    lines:         sale.items.map(i => ({ name: i.name, qty: i.qty, subtotalUsd: i.qty * i.price_usd })),
    totalUsd:      sale.total_usd,
    rate:          sale.rate,
    paymentMethod: isCredit ? 'Crédito' : sale.payment_method,
    notes:         isCredit ? `Crédito registrado${due ? `, vence ${due}` : ''}. Saldo pendiente: $${sale.total_usd.toFixed(2)}.` : null,
  })
}

export function SuccessTicketPanel({ sale, businessName, onClose }: Props) {
  const [posMode, setPosMode] = useState<PosMode>('ticket')

  useEffect(() => {
    fetch('/api/config/business')
      .then(r => r.ok ? r.json() : null)
      .then((j: { ok: boolean; business?: { pos_mode?: PosMode } } | null) => {
        if (j?.business?.pos_mode) setPosMode(j.business.pos_mode)
      })
      .catch(() => {})
  }, [])

  const handleWhatsApp = () => {
    const msg = buildWhatsappMessage(sale, businessName)
    window.open(whatsappPickChatUrl(msg), '_blank')
  }

  const handlePrint = () => {
    const endpoint = posMode === 'invoice' ? 'invoice' : 'ticket'
    window.open(`/api/sales/${sale.id}/${endpoint}`, '_blank')
  }

  const isCredit = sale.status === 'credit'
  const totalUsd = `$${sale.total_usd.toFixed(2)}`
  const totalBs  = `Bs. ${sale.total_bs.toLocaleString('es-VE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        <motion.div
          className={styles.card}
          initial={{ scale: 0.82, opacity: 0, y: 20 }}
          animate={{ scale: 1,    opacity: 1, y: 0  }}
          exit={{    scale: 0.93, opacity: 0, y: 10 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28, delay: 0.05 }}
          role="dialog"
          aria-modal="true"
          aria-label={isCredit ? 'Crédito registrado' : 'Venta registrada'}
        >
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>

          {/* ── Animated check icon ── */}
          <div className={styles.iconWrap} aria-hidden="true">
            <svg className={styles.checkSvg} viewBox="0 0 48 48" fill="none">
              <circle
                className={styles.checkCircle}
                cx="24" cy="24" r="20"
                stroke="var(--success)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                className={styles.checkMark}
                d="M14 24.5L21 31.5L34 17"
                stroke="var(--success)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* ── Heading ── */}
          <h2 className={styles.heading}>
            {isCredit ? 'Crédito registrado' : '¡Venta registrada!'}
          </h2>
          <p className={styles.ticketNum}>{sale.ticket_number}</p>
          {sale.price_mode && <PriceModeSwitch mode={sale.price_mode} readOnly />}

          {/* ── Totals ── */}
          <div className={styles.totals}>
            <span className={styles.totalUsd}>{totalUsd}</span>
            <span className={styles.totalBs}>{totalBs}</span>
            {sale.payment_method && (
              <span className={styles.paymentPill}>{sale.payment_method}</span>
            )}
            {isCredit && sale.due_date && (
              <span className={styles.dueDateLine}>
                Vence:{' '}
                {new Date(sale.due_date + 'T00:00:00').toLocaleDateString('es-VE', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </span>
            )}
          </div>

          {/* ── Actions ── */}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnWhatsapp}
              onClick={handleWhatsApp}
            >
              <MessageCircle size={17} strokeWidth={2} aria-hidden="true" />
              Enviar por WhatsApp
            </button>

            <button
              type="button"
              className={styles.btnPrint}
              onClick={handlePrint}
            >
              <Printer size={16} strokeWidth={1.75} aria-hidden="true" />
              {posMode === 'invoice' ? 'Imprimir factura' : 'Imprimir ticket'}
            </button>

            <button
              type="button"
              className={styles.btnNew}
              onClick={onClose}
              autoFocus
            >
              <span>Nueva venta</span>
              <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
