'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { InvoiceReviewModal } from '../InvoiceReviewModal'
import adminStyles from '../../admin.module.css'
import styles from './invoiceDetail.module.css'

type InvoiceStatus = 'pending' | 'pending_review' | 'paid' | 'rejected'

interface InvoiceDetail {
  id:             number
  invoice_number: string
  status:         InvoiceStatus
  business: {
    name:  string
    email: string | null
    phone: string | null
  }
  channel:    string
  reference:  string | null
  amount_usd: number
  created_at: string
  period:     string | null
  review: {
    notes:       string | null
    reviewed_by: string | null
    reviewed_at: string | null
  } | null
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending:        'Pendiente',
  pending_review: 'En revisión',
  paid:           'Pagada',
  rejected:       'Rechazada',
}

function statusBadgeClass(status: InvoiceStatus, styles: Record<string, string>) {
  switch (status) {
    case 'paid':           return styles.badgeActive
    case 'pending_review': return styles.badgeTrial
    case 'rejected':       return styles.badgeDanger
    default:                return styles.badgeInactive
  }
}

type LoadState = 'loading' | 'error' | 'ready' | 'notfound'

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [invoice, setInvoice]     = useState<InvoiceDetail | null>(null)
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null)

  const fetchInvoice = useCallback(async () => {
    setLoadState('loading')
    try {
      const res = await fetch(`/api/admin/invoices/${params.id}`)
      if (res.status === 404) { setLoadState('notfound'); return }
      if (!res.ok) { setLoadState('error'); return }
      const body = await res.json() as { ok: boolean; invoice: InvoiceDetail }
      setInvoice(body.invoice)
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }, [params.id])

  useEffect(() => { void fetchInvoice() }, [fetchInvoice])

  if (loadState === 'loading') {
    return <div className={adminStyles.emptyState}>Cargando...</div>
  }

  if (loadState === 'error' || loadState === 'notfound' || !invoice) {
    return (
      <div>
        <Link href="/invoices" className={styles.backLink}>
          <ArrowLeft size={14} aria-hidden="true" /> Volver a Facturas
        </Link>
        <div className={adminStyles.emptyState}>
          {loadState === 'notfound' ? 'Factura no encontrada.' : 'No se pudo cargar la factura. El endpoint puede no estar disponible todavía.'}
        </div>
      </div>
    )
  }

  return (
    <div>
      <Link href="/invoices" className={styles.backLink}>
        <ArrowLeft size={14} aria-hidden="true" /> Volver a Facturas
      </Link>

      <div className={styles.headerRow}>
        <div className={styles.headerTitle}>
          <h1 className={adminStyles.pageTitle}>{invoice.invoice_number}</h1>
          <span className={`${adminStyles.badge} ${statusBadgeClass(invoice.status, adminStyles)}`}>
            {STATUS_LABELS[invoice.status]}
          </span>
        </div>
        {invoice.status === 'pending_review' && (
          <div className={styles.headerActions}>
            <button
              type="button"
              className={`${adminStyles.actionLink} ${adminStyles.actionBtn}`}
              onClick={() => setReviewAction('approve')}
            >
              Aprobar
            </button>
            <button
              type="button"
              className={`${adminStyles.actionLink} ${adminStyles.actionBtn} ${adminStyles.actionDanger}`}
              onClick={() => setReviewAction('reject')}
            >
              Rechazar
            </button>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Negocio</h2>
        <div className={styles.infoGrid}>
          <div>
            <p className={styles.infoLabel}>Nombre</p>
            <p className={styles.infoValue}>{invoice.business.name}</p>
          </div>
          <div>
            <p className={styles.infoLabel}>Correo</p>
            <p className={styles.infoValue}>{invoice.business.email ?? '—'}</p>
          </div>
          <div>
            <p className={styles.infoLabel}>Teléfono</p>
            <p className={styles.infoValue}>{invoice.business.phone ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Pago</h2>
        <div className={styles.infoGrid}>
          <div>
            <p className={styles.infoLabel}>Canal</p>
            <p className={styles.infoValue}>{invoice.channel}</p>
          </div>
          <div>
            <p className={styles.infoLabel}>Referencia</p>
            <p className={styles.infoValue}>{invoice.reference ?? '—'}</p>
          </div>
          <div>
            <p className={styles.infoLabel}>Monto</p>
            <p className={styles.infoValue}>${invoice.amount_usd.toFixed(2)}</p>
          </div>
          <div>
            <p className={styles.infoLabel}>Fecha</p>
            <p className={styles.infoValue}>
              {new Date(invoice.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div>
            <p className={styles.infoLabel}>Período</p>
            <p className={styles.infoValue}>{invoice.period ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Revisión</h2>
        {invoice.review ? (
          <div className={styles.infoGrid}>
            <div>
              <p className={styles.infoLabel}>Revisado por</p>
              <p className={styles.infoValue}>{invoice.review.reviewed_by ?? '—'}</p>
            </div>
            <div>
              <p className={styles.infoLabel}>Fecha de revisión</p>
              <p className={styles.infoValue}>
                {invoice.review.reviewed_at
                  ? new Date(invoice.review.reviewed_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '—'}
              </p>
            </div>
            <div>
              <p className={styles.infoLabel}>Notas</p>
              <p className={styles.infoValue}>{invoice.review.notes ?? '—'}</p>
            </div>
          </div>
        ) : (
          <div className={adminStyles.emptyState}>Aún sin revisar.</div>
        )}
      </div>

      {reviewAction && (
        <InvoiceReviewModal
          invoiceId={invoice.id}
          invoiceLabel={invoice.invoice_number}
          action={reviewAction}
          onClose={() => setReviewAction(null)}
          onDone={() => { setReviewAction(null); void fetchInvoice() }}
        />
      )}
    </div>
  )
}
