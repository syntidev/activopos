'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RotateCcw, Search, CheckCircle2, Package,
  AlertCircle, Clock, X,
} from 'lucide-react'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { HelpButton } from '@/components/help/HelpButton'
import type { PaymentMethodRecord } from '@/types'
import styles from './devoluciones.module.css'

/* ── Types ── */

interface SaleItem {
  id: number
  product_id: number
  product_name: string
  quantity: number | string
  price_per_unit_usd: number | string | null
  sale_mode: string
  base_unit_label?: string
  // Contrato de devoluciones (CLI-A). Opcionales: si el backend aún no los
  // manda, la línea se comporta como antes (devolvible = vendido).
  sale_item_id?:   number
  qty_sold?:       number | string
  qty_returned?:   number | string
  qty_returnable?: number | string
}

interface Sale {
  id: number
  ticket_number: string
  status: string
  sold_at: string
  total_usd: number | string
  total_bs: number | string
  rate_used: number | string
  items: SaleItem[]
  client: { id: number; name: string; phone: string | null } | null
  cashier: { id: number; name: string } | null
}

interface ReturnRecord {
  id: number
  status: string
  reason: string
  total_usd: number
  total_bs: number
  created_at: string
  sale: { id: number; ticket_number: string; sold_at?: string } | null
  refund_payment_method?: { id: number; name: string; type: string } | null
  items: Array<{ product_id: number; qty: number; price_usd: number; total_usd: number }>
}

/** Cantidades de una línea; sin los campos nuevos, devolvible = vendido (comportamiento previo). */
function lineQty(it: SaleItem): { lineId: number; sold: number; returned: number | null; returnable: number } {
  const sold = it.qty_sold !== undefined ? Number(it.qty_sold) : Number(it.quantity)
  return {
    lineId:     it.sale_item_id ?? it.id,
    sold,
    returned:   it.qty_returned !== undefined ? Number(it.qty_returned) : null,
    returnable: it.qty_returnable !== undefined ? Number(it.qty_returnable) : sold,
  }
}

/** paid siempre; partial_return solo si el backend ya informa qty_returnable por línea. */
function isReturnableSale(s: Sale): boolean {
  if (s.status === 'paid') return true
  return s.status === 'partial_return' && s.items.every(it => it.qty_returnable !== undefined)
}

type Step = 'search' | 'select' | 'done'

interface ReturnErrorBody {
  error?:      string
  issues?:     Array<{ path?: (string | number)[]; message: string }>
  disponible?: number
}

// Mensaje real del servidor: 400 trae issues de Zod; 422 trae error (+ disponible).
function returnErrorMessage(data: ReturnErrorBody | null): string {
  const issue = data?.issues?.[0]
  if (issue) return issue.path?.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message
  if (!data?.error) return 'Error al registrar devolución'
  return typeof data.disponible === 'number' ? `${data.error} (disponible: ${data.disponible})` : data.error
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)   return 'ahora'
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  const h = Math.floor(diff / 3600)
  if (h < 24)      return `${h}h`
  return new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: '2-digit' })
}

/* ── Main content ── */

function DevolucionesContent() {
  const { toast } = useToast()

  // Search step
  const [step, setStep]             = useState<Step>('search')
  const [ticketInput, setTicket]    = useState('')
  const [searching, setSearching]   = useState(false)
  const [searchErr, setSearchErr]   = useState('')
  const [foundSale, setFoundSale]   = useState<Sale | null>(null)

  // Select step — checked/returnQty van por LÍNEA de venta (SaleItem.id), no por
  // producto: un mismo producto puede estar en varias líneas con costo distinto.
  const [checked, setChecked]       = useState<Set<number>>(new Set())
  const [returnQty, setReturnQty]   = useState<Map<number, string>>(new Map())
  const [reason, setReason]         = useState('')
  const [restoresStock, setRestores] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  // Método por el que SALE el reembolso. Sin valor por defecto: el método real
  // define si baja el efectivo esperado de la caja (estándar contable).
  const [refundMethods, setRefundMethods] = useState<PaymentMethodRecord[] | null>(null)
  const [methodsError, setMethodsError]   = useState('')
  const [refundMethodId, setRefundMethodId] = useState('')

  // History
  const [history, setHistory]       = useState<ReturnRecord[]>([])
  const [loadingHist, setLoadingHist] = useState(true)

  // Load return history
  const fetchHistory = useCallback(async () => {
    try {
      const r = await fetch('/api/returns?limit=20')
      if (r.ok) {
        const d = await r.json() as { returns?: ReturnRecord[] }
        setHistory(d.returns ?? [])
      }
    } catch { /* ignore */ }
    finally { setLoadingHist(false) }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  useEffect(() => {
    let active = true
    fetch('/api/config/payment-methods')
      .then(async r => {
        const d = await r.json().catch(() => null) as { methods?: PaymentMethodRecord[]; error?: string } | null
        if (!r.ok || !d?.methods) throw new Error(d?.error ?? 'No se pudieron cargar los métodos de cobro.')
        if (active) setRefundMethods(d.methods.filter(m => m.is_active))
      })
      .catch((err: unknown) => {
        if (active) setMethodsError(err instanceof Error ? err.message : 'No se pudieron cargar los métodos de cobro.')
      })
    return () => { active = false }
  }, [])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = ticketInput.trim()
    if (!q) return
    setSearching(true)
    setSearchErr('')
    try {
      // Sin filtro de status: la venta puede estar paid o partial_return
      // (isReturnableSale decide); el ticket es casi único, 10 basta.
      const r = await fetch(`/api/sales?ticket=${encodeURIComponent(q)}&limit=10`)
      if (!r.ok) throw new Error('API error')
      const d = await r.json() as { sales?: Sale[] }
      const sales = d.sales ?? []
      const match = sales.find(isReturnableSale) ?? null
      if (match) {
        setFoundSale(match)
        setChecked(new Set())
        setReturnQty(new Map())
        setStep('select')
      } else if (sales.some(s => s.status === 'returned')) {
        setSearchErr(`La venta "${q}" ya fue devuelta por completo.`)
      } else if (sales.some(s => s.status === 'partial_return')) {
        setSearchErr(`La venta "${q}" ya tiene una devolución parcial y todavía no admite otra.`)
      } else {
        setSearchErr(`No se encontró una venta pagada con el ticket "${q}". Verifica el número.`)
      }
    } catch {
      setSearchErr('Error al buscar. Intenta de nuevo.')
    } finally {
      setSearching(false)
    }
  }

  function toggleItem(saleItemId: number, returnable: number) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(saleItemId)) {
        next.delete(saleItemId)
      } else {
        next.add(saleItemId)
        setReturnQty(m => {
          const nm = new Map(m)
          if (!nm.has(saleItemId)) nm.set(saleItemId, String(returnable))
          return nm
        })
      }
      return next
    })
  }

  function setQty(saleItemId: number, val: string) {
    setReturnQty(prev => new Map(prev).set(saleItemId, val))
  }

  const checkedItems = foundSale?.items.filter(it => checked.has(lineQty(it).lineId)) ?? []
  const canSubmit    = checkedItems.length > 0 && reason.trim().length >= 3 && refundMethodId !== '' &&
    checkedItems.every(it => {
      const { lineId, returnable } = lineQty(it)
      const q = parseFloat(returnQty.get(lineId) ?? '0')
      return q > 0 && q <= returnable
    })

  const returnTotal = checkedItems.reduce((s, it) => {
    const q    = parseFloat(returnQty.get(lineQty(it).lineId) ?? '0') || 0
    const p    = Number(it.price_per_unit_usd) || 0
    return s + q * p
  }, 0)
  // Misma tasa con que el servidor calcula total_bs: la de la venta original.
  const returnTotalBs = returnTotal * (Number(foundSale?.rate_used) || 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!foundSale || !canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sale_id:        foundSale.id,
          reason:         reason.trim(),
          restores_stock: restoresStock,
          refund_payment_method_id: Number(refundMethodId),
          items: checkedItems.map(it => {
            const { lineId } = lineQty(it)
            return {
              product_id:   it.product_id,
              qty:          parseFloat(returnQty.get(lineId) ?? '1'),
              sale_item_id: lineId,
            }
          }),
        }),
      })
      const data = await res.json().catch(() => null) as ({ ok?: boolean; return?: ReturnRecord } & ReturnErrorBody) | null
      if (res.ok && data?.return) {
        const created = data.return
        setHistory(prev => [created, ...prev])
        setStep('done')
        toast('Devolución registrada — stock actualizado', 'success')
      } else {
        toast(returnErrorMessage(data), 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function resetFlow() {
    setStep('search')
    setTicket('')
    setFoundSale(null)
    setChecked(new Set())
    setReturnQty(new Map())
    setReason('')
    setRestores(true)
    setRefundMethodId('')
    setSearchErr('')
  }

  return (
    <div className={`${styles.page} page-container`}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Devoluciones</h1>
          <p className={styles.pageSubtitle}>Revertir ítems de una venta pagada</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className={styles.steps} aria-label="Pasos del proceso">
        {(['search', 'select', 'done'] as const).map((s, i) => {
          const labels = ['Buscar venta', 'Seleccionar ítems', 'Confirmación']
          const done   = step === 'done' || (step === 'select' && i === 0)
          const active = step === s
          return (
            <div key={s} className={`${styles.stepItem} ${active ? styles.stepActive : ''} ${done ? styles.stepDone : ''}`}>
              <span className={styles.stepDot}>
                {done && !active ? <CheckCircle2 size={14} aria-hidden="true" /> : (i + 1)}
              </span>
              <span className={styles.stepLabel}>{labels[i]}</span>
            </div>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* ── Step 1: Search ── */}
        {step === 'search' && (
          <motion.section
            key="search"
            className={styles.stepCard}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          >
            <h2 className={styles.stepTitle}>
              <Search size={16} aria-hidden="true" />
              Buscar venta por número de ticket
            </h2>
            <form onSubmit={handleSearch} className={styles.searchForm}>
              <input
                type="text"
                className={styles.searchInput}
                value={ticketInput}
                onChange={e => { setTicket(e.target.value); setSearchErr('') }}
                placeholder="Ej: TKT-2024-0042"
                aria-label="Número de ticket"
                autoFocus
              />
              <button type="submit" className={styles.btnPri} disabled={searching || !ticketInput.trim()}>
                {searching
                  ? <><span className={styles.spinner} aria-hidden="true" />Buscando…</>
                  : <><Search size={14} aria-hidden="true" />Buscar</>}
              </button>
            </form>
            {searchErr && (
              <div className={styles.errorMsg}>
                <AlertCircle size={14} aria-hidden="true" />
                {searchErr}
              </div>
            )}
          </motion.section>
        )}

        {/* ── Step 2: Select items ── */}
        {step === 'select' && foundSale && (
          <motion.section
            key="select"
            className={styles.stepCard}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          >
            <div className={styles.saleInfo}>
              <div className={styles.saleInfoLeft}>
                <span className={styles.saleTicket}>{foundSale.ticket_number}</span>
                {foundSale.client && <span className={styles.saleClient}>{foundSale.client.name}</span>}
              </div>
              <div className={styles.saleInfoRight}>
                <span className={styles.saleTotal}>${Number(foundSale.total_usd).toFixed(2)}</span>
                <span className={styles.muted}>{new Date(foundSale.sold_at).toLocaleDateString('es-VE')}</span>
              </div>
              <button type="button" className={styles.changeBtn} onClick={resetFlow}
                aria-label="Cambiar venta">
                <X size={13} aria-hidden="true" />
                Cambiar
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.selectForm}>
              <h2 className={styles.stepTitle}>
                <Package size={16} aria-hidden="true" />
                Selecciona los ítems a devolver
              </h2>

              <div className={styles.itemsSelect}>
                {foundSale.items.map(it => {
                  const { lineId, sold, returned, returnable } = lineQty(it)
                  const isChecked = checked.has(lineId)
                  const qtyVal    = returnQty.get(lineId) ?? String(returnable)
                  const maxQty    = returnable
                  const nothingLeft = returnable <= 0
                  return (
                    <div key={lineId}
                      className={`${styles.selectRow} ${isChecked ? styles.selectRowActive : ''} ${nothingLeft ? styles.selectRowDisabled : ''}`}>
                      <label className={styles.checkLabel}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={isChecked}
                          disabled={nothingLeft}
                          onChange={() => toggleItem(lineId, returnable)}
                          aria-label={`Devolver ${it.product_name}`}
                        />
                        <span className={styles.itemProductName}>{it.product_name}</span>
                        <span className={styles.itemQtySold}>
                          {returned === null ? `vendido: ${sold}` : `devuelto ${returned} de ${sold}`}
                        </span>
                      </label>
                      {isChecked && (
                        <div className={styles.returnQtyWrap}>
                          <span className={styles.returnQtyLabel}>Devolver:</span>
                          <input
                            type="number"
                            className={styles.returnQtyInput}
                            value={qtyVal}
                            onChange={e => setQty(lineId, e.target.value)}
                            min="0.001"
                            max={maxQty}
                            step="any"
                            aria-label={`Cantidad a devolver de ${it.product_name}`}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {checkedItems.length > 0 && (
                <div className={styles.returnSummary}>
                  <span>Total a devolver:</span>
                  <span className={styles.summaryAmounts}>
                    <span className={styles.usd}>${returnTotal.toFixed(2)}</span>
                    <span className={styles.bs}>Bs.&nbsp;{returnTotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                </div>
              )}

              <div className={styles.reasonField}>
                <label htmlFor="dev-reason" className={styles.label}>
                  Motivo de la devolución *
                </label>
                <textarea
                  id="dev-reason"
                  className={styles.textarea}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Ej: Producto dañado, cliente arrepentido…"
                  required
                />
                {reason.length > 0 && reason.length < 3 && (
                  <p className={styles.fieldHint}>Mínimo 3 caracteres</p>
                )}
              </div>

              <div className={styles.reasonField}>
                <label htmlFor="dev-refund-method" className={styles.label}>
                  Método de reembolso *
                </label>
                <select
                  id="dev-refund-method"
                  className={styles.selectInput}
                  value={refundMethodId}
                  onChange={e => setRefundMethodId(e.target.value)}
                  required
                >
                  <option value="" disabled>Selecciona cómo se devuelve el dinero</option>
                  {(refundMethods ?? []).map(m => (
                    <option key={m.id} value={String(m.id)}>{m.name}</option>
                  ))}
                </select>
                {methodsError && <p className={styles.fieldHint}>{methodsError}</p>}
                {!methodsError && refundMethods?.length === 0 && (
                  <p className={styles.fieldHint}>No hay métodos de cobro activos. Actívalos en Configuración &gt; Medios de Cobro.</p>
                )}
              </div>

              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={restoresStock}
                  onChange={e => setRestores(e.target.checked)}
                />
                <span>Restaurar stock al inventario</span>
              </label>

              <div className={styles.formActions}>
                <button type="button" className={styles.btnSec} onClick={resetFlow}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPri}
                  disabled={submitting || !canSubmit}>
                  {submitting && <span className={styles.spinner} aria-hidden="true" />}
                  {submitting ? 'Registrando…' : 'Registrar devolución'}
                </button>
              </div>
            </form>
          </motion.section>
        )}

        {/* ── Step 3: Done ── */}
        {step === 'done' && (
          <motion.section
            key="done"
            className={`${styles.stepCard} ${styles.doneCard}`}
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
          >
            <CheckCircle2 size={40} className={styles.doneIcon} aria-hidden="true" />
            <h2 className={styles.doneTitle}>Devolución registrada</h2>
            <p className={styles.doneSub}>
              {restoresStock ? 'El stock fue actualizado automáticamente.' : 'Stock no restaurado.'}
            </p>
            <button className={styles.btnPri} onClick={resetFlow} type="button">
              <RotateCcw size={14} aria-hidden="true" />
              Nueva devolución
            </button>
          </motion.section>
        )}
      </AnimatePresence>

      {/* History */}
      <section className={styles.historySection}>
        <h2 className={styles.historyTitle}>
          <Clock size={14} aria-hidden="true" />
          Historial reciente
        </h2>
        {loadingHist ? (
          <div className={styles.skeletonWrap}>
            {[0, 1, 2].map(i => <div key={i} className={styles.skeletonRow} />)}
          </div>
        ) : history.length === 0 ? (
          <div className={styles.historyEmpty}>Sin devoluciones registradas</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label="Historial de devoluciones">
              <thead className={styles.thead}>
                <tr>
                  <th className={styles.th}>Ticket original</th>
                  <th className={`${styles.th} ${styles.thHidden}`}>Motivo</th>
                  <th className={`${styles.th} ${styles.thHidden}`}>Método</th>
                  <th className={styles.th}>Estado</th>
                  <th className={`${styles.th} ${styles.thNum}`}>Total</th>
                  <th className={`${styles.th} ${styles.thHidden}`}>Hace</th>
                </tr>
              </thead>
              <tbody>
                {history.map(r => (
                  <tr key={r.id} className={styles.tr}>
                    <td className={styles.td} data-label="Ticket original">
                      <span className={styles.ticketRef}>
                        {r.sale?.ticket_number ?? '—'}
                      </span>
                    </td>
                    <td className={`${styles.td} ${styles.tdHidden}`} data-label="Motivo">
                      <span className={styles.reasonText}>{r.reason}</span>
                    </td>
                    <td className={`${styles.td} ${styles.tdHidden}`} data-label="Método">
                      <span className={styles.reasonText}>{r.refund_payment_method?.name ?? '—'}</span>
                    </td>
                    <td className={styles.td} data-label="Estado">
                      <span className={`${styles.statusChip} ${r.status === 'approved' ? styles.statusApproved : r.status === 'rejected' ? styles.statusRejected : styles.statusPending}`}>
                        {r.status === 'approved' ? 'Aprobada' : r.status === 'rejected' ? 'Rechazada' : 'Pendiente'}
                      </span>
                    </td>
                    <td className={`${styles.td} ${styles.tdNum}`} data-label="Total">
                      <span className={styles.usd}>${r.total_usd.toFixed(2)}</span>
                      <span className={styles.bs}>Bs.&nbsp;{r.total_bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </td>
                    <td className={`${styles.td} ${styles.tdHidden}`} data-label="Hace">
                      <span className={styles.muted}>{timeAgo(r.created_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <HelpButton module="devoluciones" />
    </div>
  )
}

export default function DevolucionesPage() {
  return (
    <ToastProvider>
      <DevolucionesContent />
    </ToastProvider>
  )
}
