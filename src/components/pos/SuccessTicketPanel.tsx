'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Printer, MessageCircle, ArrowRight } from 'lucide-react'
import styles from './SuccessTicketPanel.module.css'

export interface SaleItemForPanel {
  name:      string
  qty:       number
  price_usd: number
}

export interface SaleSummary {
  id:             number
  ticket_number:  string
  status:         'paid' | 'pending' | 'quote'
  total_usd:      number
  total_bs:       number
  due_date:       string | null
  payment_method: string
  rate:           number
  items:          SaleItemForPanel[]
}

interface Props {
  sale:         SaleSummary
  businessName: string
  onClose:      () => void
}

function buildWhatsappMessage(sale: SaleSummary, businessName: string): string {
  const now   = new Date()
  const fecha = now.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
  const hora  = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })

  const itemLines = sale.items
    .map(i => {
      const label   = `${i.name} x${i.qty}`
      const subtotal = `$${(i.qty * i.price_usd).toFixed(2)}`
      return `${label}   ${subtotal}`
    })
    .join('\n')

  const totalUsd = sale.total_usd.toFixed(2)
  const totalBs  = sale.total_bs.toLocaleString('es-VE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
  const rate = Math.round(sale.rate).toLocaleString('es-VE')

  if (sale.status === 'pending') {
    const due = sale.due_date
      ? new Date(sale.due_date + 'T00:00:00').toLocaleDateString('es-VE', {
          day: '2-digit', month: 'short', year: 'numeric',
        })
      : '—'
    return (
      `💳 *Crédito registrado — ${sale.ticket_number}*\n` +
      `📅 ${fecha}\n\n` +
      `${itemLines}\n` +
      `─────────────────────\n` +
      `*Total: $${totalUsd}*\n` +
      `*Vence: ${due}*\n` +
      `Saldo pendiente: $${totalUsd}\n\n` +
      `Puede abonar contactándonos.`
    )
  }

  const header = businessName
    ? `🧾 *${businessName} — Ticket ${sale.ticket_number}*`
    : `🧾 *Ticket ${sale.ticket_number}*`

  return (
    `${header}\n` +
    `📅 ${fecha} · ${hora}\n\n` +
    `${itemLines}\n` +
    `─────────────────────\n` +
    `*TOTAL: $${totalUsd}*\n` +
    `*Bs. ${totalBs}* · Tasa BCV: ${rate}\n\n` +
    `💳 ${sale.payment_method}\n\n` +
    `¡Gracias por su compra!`
  )
}

export function SuccessTicketPanel({ sale, businessName, onClose }: Props) {
  const handleWhatsApp = () => {
    const msg = buildWhatsappMessage(sale, businessName)
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const handlePrint = () => {
    window.open(`/api/sales/${sale.id}/ticket`, '_blank')
  }

  const isCredit = sale.status === 'pending'
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
              Imprimir ticket
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
