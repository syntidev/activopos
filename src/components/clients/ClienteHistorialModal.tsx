'use client'

import { useState, useEffect, useCallback } from 'react'
import { Modal }   from '@/components/ui/Modal'
import { Button }  from '@/components/ui/Button'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Input }   from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { Calendar, Hash, Plus, AlertCircle, Loader2 } from 'lucide-react'
import type {
  ClientHistoryData,
  SaleHistoryItem,
  PaymentMethod,
  AbonoTarget,
  AbonoForm,
} from '@/types'
import styles from './ClienteHistorialModal.module.css'

interface ClienteHistorialModalProps {
  clientId: number
  open:     boolean
  onClose:  () => void
}

const STATUS_LABELS: Record<SaleHistoryItem['status'], string> = {
  quote:     'Cotización',
  pending:   'Pendiente',
  paid:      'Pagado',
  cancelled: 'Anulado',
}

const STATUS_VARIANT: Record<SaleHistoryItem['status'], BadgeVariant> = {
  quote:     'info',
  pending:   'warning',
  paid:      'success',
  cancelled: 'danger',
}

function fmtDate(d: Date | string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-VE', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtUsd(n: number): string {
  return '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

const EMPTY_ABONO: AbonoForm = {
  amount_usd: '', payment_method_id: '', reference: '', notes: '',
}

export function ClienteHistorialModal({
  clientId,
  open,
  onClose,
}: ClienteHistorialModalProps) {
  const { toast } = useToast()

  const [data, setData]       = useState<ClientHistoryData | null>(null)
  const [loading, setLoading] = useState(false)

  const [abonoTarget, setAbonoTarget]   = useState<AbonoTarget | null>(null)
  const [abonoForm, setAbonoForm]       = useState<AbonoForm>(EMPTY_ABONO)
  const [abonoLoading, setAbonoLoading] = useState(false)
  const [abonoError, setAbonoError]     = useState('')

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/clients/${clientId}/history`)
      if (!res.ok) throw new Error('fetch-error')
      const body = await res.json() as {
        client:         ClientHistoryData['client']
        sales:          SaleHistoryItem[]
        paymentMethods: PaymentMethod[]
      }
      setData({ client: body.client, sales: body.sales, paymentMethods: body.paymentMethods })
    } catch {
      toast('Error al cargar el historial.', 'error')
    } finally {
      setLoading(false)
    }
  }, [clientId, toast])

  useEffect(() => {
    if (open) void fetchHistory()
  }, [open, fetchHistory])

  const openAbono = (sale: SaleHistoryItem) => {
    const defaultPmId = data?.paymentMethods[0]?.id
    setAbonoTarget({
      saleId:       sale.id,
      ticketNumber: sale.ticket_number,
      maxAmount:    sale.balance_remaining,
    })
    setAbonoForm({
      ...EMPTY_ABONO,
      amount_usd:        sale.balance_remaining.toFixed(2),
      payment_method_id: defaultPmId ? String(defaultPmId) : '',
    })
    setAbonoError('')
  }

  const handleAbonoSubmit = async () => {
    if (!abonoTarget) return

    const amount = parseFloat(abonoForm.amount_usd)
    if (!amount || amount <= 0) {
      setAbonoError('El monto debe ser mayor a cero.')
      return
    }
    if (amount - abonoTarget.maxAmount > 0.001) {
      setAbonoError(`Monto máximo: ${fmtUsd(abonoTarget.maxAmount)}`)
      return
    }
    if (!abonoForm.payment_method_id) {
      setAbonoError('Selecciona un método de pago.')
      return
    }

    setAbonoLoading(true)
    setAbonoError('')
    try {
      const res = await fetch(`/api/clients/${clientId}/abono`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          sale_id:           abonoTarget.saleId,
          amount_usd:        amount,
          payment_method_id: parseInt(abonoForm.payment_method_id),
          reference:         abonoForm.reference.trim() || undefined,
          notes:             abonoForm.notes.trim()     || undefined,
        }),
      })
      const body = await res.json() as { error?: string }
      if (!res.ok) {
        setAbonoError(body.error ?? 'Error al registrar abono.')
        return
      }
      setAbonoTarget(null)
      toast('Abono registrado correctamente.', 'success')
      await fetchHistory()
    } catch {
      setAbonoError('Error de conexión. Intenta de nuevo.')
    } finally {
      setAbonoLoading(false)
    }
  }

  const pendingBalance = data?.client.pending_balance_usd ?? 0

  return (
    <>
      {/* ── Historial principal ── */}
      <Modal open={open} onClose={onClose} title="Historial de Cliente" size="lg">
        {loading ? (
          <div className={styles.loadingState}>
            <Loader2 size={24} className={styles.spinner} aria-hidden="true" />
            <p className={styles.loadingText}>Cargando historial...</p>
          </div>

        ) : data ? (
          <div className={styles.body}>
            {/* Client header */}
            <div className={styles.clientHeader}>
              <div>
                <p className={styles.clientName}>{data.client.name}</p>
                <div className={styles.clientMeta}>
                  {data.client.cedula && <span>{data.client.cedula}</span>}
                  {data.client.phone  && <span>{data.client.phone}</span>}
                </div>
              </div>
              {pendingBalance > 0 ? (
                <Badge variant="warning">Saldo: {fmtUsd(pendingBalance)}</Badge>
              ) : (
                <Badge variant="success">Al día</Badge>
              )}
            </div>

            <div className={styles.divider} />

            {/* Sales */}
            {data.sales.length === 0 ? (
              <p className={styles.emptyText}>
                Este cliente no tiene ventas registradas.
              </p>
            ) : (
              <div className={styles.salesList}>
                {data.sales.map((sale) => (
                  <div key={sale.id} className={styles.saleCard}>
                    {/* Sale row */}
                    <div className={styles.saleHeader}>
                      <div className={styles.saleMeta}>
                        <span className={styles.ticketNum}>
                          <Hash size={12} strokeWidth={2} aria-hidden="true" />
                          {sale.ticket_number}
                        </span>
                        <span className={styles.saleDate}>
                          <Calendar size={12} strokeWidth={1.75} aria-hidden="true" />
                          {fmtDate(sale.sold_at ?? sale.created_at)}
                        </span>
                      </div>
                      <div className={styles.saleRight}>
                        <span className={styles.saleTotal}>{fmtUsd(sale.total_usd)}</span>
                        <Badge variant={STATUS_VARIANT[sale.status]} size="sm">
                          {STATUS_LABELS[sale.status]}
                        </Badge>
                      </div>
                    </div>

                    {/* CxC section — only for pending sales */}
                    {sale.status === 'pending' && (
                      <div className={styles.cxcSection}>
                        {sale.abonos.length > 0 && (
                          <ul className={styles.abonosList} role="list">
                            {sale.abonos.map((a) => (
                              <li key={a.id} className={styles.abonoRow}>
                                <span className={styles.abonoDate}>
                                  {fmtDate(a.created_at)}
                                </span>
                                <span className={styles.abonoAmount}>
                                  +{fmtUsd(a.amount_usd)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className={styles.balanceRow}>
                          <span className={styles.balanceLabel}>Restante</span>
                          <span className={styles.balanceValue}>
                            {fmtUsd(sale.balance_remaining)}
                          </span>
                        </div>
                        {sale.balance_remaining > 0 && (
                          <button
                            className={styles.abonoBtn}
                            onClick={() => openAbono(sale)}
                            type="button"
                          >
                            <Plus size={13} strokeWidth={2} aria-hidden="true" />
                            Registrar abono
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        ) : (
          <div className={styles.errorState}>
            <AlertCircle size={24} aria-hidden="true" />
            <p>No se pudo cargar el historial.</p>
          </div>
        )}
      </Modal>

      {/* ── Abono mini-modal ── */}
      <Modal
        open={abonoTarget !== null}
        onClose={() => setAbonoTarget(null)}
        title={`Registrar Abono — ${abonoTarget?.ticketNumber ?? ''}`}
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setAbonoTarget(null)}
              disabled={abonoLoading}
            >
              Cancelar
            </Button>
            <Button variant="primary" loading={abonoLoading} onClick={handleAbonoSubmit}>
              Registrar
            </Button>
          </>
        }
      >
        <div className={styles.abonoForm}>
          {abonoTarget && (
            <p className={styles.abonoMax}>
              Saldo a cubrir: <strong>{fmtUsd(abonoTarget.maxAmount)}</strong>
            </p>
          )}

          <Input
            label="Monto (USD)"
            type="number"
            placeholder="0.00"
            value={abonoForm.amount_usd}
            onChange={(e) =>
              setAbonoForm((prev) => ({ ...prev, amount_usd: e.target.value }))
            }
            required
          />

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="abono-pm">
              Método de pago
            </label>
            <select
              id="abono-pm"
              className={styles.select}
              value={abonoForm.payment_method_id}
              onChange={(e) =>
                setAbonoForm((prev) => ({ ...prev, payment_method_id: e.target.value }))
              }
            >
              <option value="">Seleccionar...</option>
              {data?.paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
          </div>

          <Input
            label="Referencia"
            placeholder="Nro. de operación (opcional)"
            value={abonoForm.reference}
            onChange={(e) =>
              setAbonoForm((prev) => ({ ...prev, reference: e.target.value }))
            }
            hint="Opcional"
          />

          <Input
            label="Notas"
            placeholder="Observaciones (opcional)"
            value={abonoForm.notes}
            onChange={(e) =>
              setAbonoForm((prev) => ({ ...prev, notes: e.target.value }))
            }
            hint="Opcional"
          />

          {abonoError && (
            <p className={styles.serverError} role="alert">{abonoError}</p>
          )}
        </div>
      </Modal>
    </>
  )
}
