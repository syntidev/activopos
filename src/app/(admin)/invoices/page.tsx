'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { InvoiceReviewModal } from './InvoiceReviewModal'
import adminStyles from '../admin.module.css'
import styles from './invoices.module.css'

type InvoiceStatus = 'pending' | 'pending_review' | 'paid' | 'rejected'

interface InvoiceRow {
  id:             number
  invoice_number: string
  business_name:  string
  amount_usd:     number
  channel:        string
  reference:      string | null
  created_at:     string
  status:         InvoiceStatus
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending:        'Pendiente',
  pending_review: 'En revisión',
  paid:           'Pagada',
  rejected:       'Rechazada',
}

function statusBadgeClass(status: InvoiceStatus) {
  switch (status) {
    case 'paid':           return adminStyles.badgeActive
    case 'pending_review': return adminStyles.badgeTrial
    case 'rejected':       return adminStyles.badgeDanger
    default:                return adminStyles.badgeInactive
  }
}

type LoadState = 'loading' | 'error' | 'ready'

interface ConfirmState {
  invoice: InvoiceRow
  action:  'approve' | 'reject'
}

export default function InvoicesPage() {
  const [loadState, setLoadState]       = useState<LoadState>('loading')
  const [invoices, setInvoices]         = useState<InvoiceRow[]>([])
  const [q, setQ]                       = useState('')
  const [status, setStatus]             = useState<InvoiceStatus | ''>('')
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)

  const fetchInvoices = useCallback(async () => {
    setLoadState('loading')
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (status) params.set('status', status)
      const res = await fetch(`/api/admin/invoices?${params.toString()}`)
      if (!res.ok) { setInvoices([]); setLoadState('error'); return }
      const body = await res.json() as { ok: boolean; invoices: InvoiceRow[] }
      setInvoices(body.invoices ?? [])
      setLoadState('ready')
    } catch {
      setInvoices([])
      setLoadState('error')
    }
  }, [q, status])

  useEffect(() => { void fetchInvoices() }, [fetchInvoices])

  function closeModal() {
    setConfirmState(null)
  }

  return (
    <div>
      <div className={adminStyles.pageHeader}>
        <h1 className={adminStyles.pageTitle}>Facturas</h1>
        <p className={adminStyles.pageSubtitle}>Pagos de suscripción reportados por los negocios</p>
      </div>

      <div className={adminStyles.tableWrap}>
        <div className={adminStyles.tableHeader}>
          <p className={adminStyles.tableTitle}>Todas las facturas</p>
          <div className={adminStyles.filterBar}>
            <div className={adminStyles.searchField}>
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por número o negocio..."
                aria-label="Buscar factura"
              />
            </div>
            <select
              className={adminStyles.planSelect}
              value={status}
              onChange={(e) => setStatus(e.target.value as InvoiceStatus | '')}
              aria-label="Filtrar por estado"
            >
              <option value="">Todos los estados</option>
              {(Object.keys(STATUS_LABELS) as InvoiceStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>

        {loadState === 'loading' && <div className={adminStyles.emptyState}>Cargando...</div>}
        {loadState === 'error' && (
          <div className={adminStyles.emptyState}>
            No se pudo cargar facturas. El endpoint puede no estar disponible todavía.
          </div>
        )}
        {loadState === 'ready' && invoices.length === 0 && (
          <div className={adminStyles.emptyState}>
            {q || status ? 'Sin resultados para este filtro.' : 'Sin facturas registradas.'}
          </div>
        )}

        {loadState === 'ready' && invoices.length > 0 && (
          <table className={`${adminStyles.table} ${styles.table}`}>
            <thead>
              <tr>
                <th>Nº Factura</th>
                <th>Negocio</th>
                <th>Monto USD</th>
                <th>Canal</th>
                <th>Referencia</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td className={adminStyles.tdName}>{inv.invoice_number}</td>
                  <td>{inv.business_name}</td>
                  <td>${inv.amount_usd.toFixed(2)}</td>
                  <td>{inv.channel}</td>
                  <td>{inv.reference ?? '—'}</td>
                  <td>{new Date(inv.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td><span className={`${adminStyles.badge} ${statusBadgeClass(inv.status)}`}>{STATUS_LABELS[inv.status]}</span></td>
                  <td className={styles.actionsCell}>
                    <Link href={`/invoices/${inv.id}`} className={adminStyles.actionLink}>Ver detalle</Link>
                    {inv.status === 'pending_review' && (
                      <>
                        <button
                          type="button"
                          className={`${adminStyles.actionLink} ${adminStyles.actionBtn}`}
                          onClick={() => setConfirmState({ invoice: inv, action: 'approve' })}
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          className={`${adminStyles.actionLink} ${adminStyles.actionBtn} ${adminStyles.actionDanger}`}
                          onClick={() => setConfirmState({ invoice: inv, action: 'reject' })}
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmState && (
        <InvoiceReviewModal
          invoiceId={confirmState.invoice.id}
          invoiceLabel={confirmState.invoice.invoice_number}
          action={confirmState.action}
          onClose={closeModal}
          onDone={() => { closeModal(); void fetchInvoices() }}
        />
      )}
    </div>
  )
}
