'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RotateCcw, Search, CheckCircle2, Package,
  AlertCircle, Clock, X,
} from 'lucide-react'
import { ToastProvider, useToast } from '@/components/ui/Toast'
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
}

interface Sale {
  id: number
  ticket_number: string
  status: string
  sold_at: string
  total_usd: number | string
  total_bs: number | string
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
  sale: { id: number; ticket_number: string; sold_at: string } | null
  items: Array<{ product_id: number; qty: number; price_usd: number; total_usd: number }>
}

type Step = 'search' | 'select' | 'done'

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

  // Select step
  const [checked, setChecked]       = useState<Set<number>>(new Set())
  const [returnQty, setReturnQty]   = useState<Map<number, string>>(new Map())
  const [reason, setReason]         = useState('')
  const [restoresStock, setRestores] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = ticketInput.trim()
    if (!q) return
    setSearching(true)
    setSearchErr('')
    try {
      const r = await fetch('/api/sales?status=paid')
      if (!r.ok) throw new Error('API error')
      const d = await r.json() as { sales?: Sale[] }
      const match = (d.sales ?? []).find(
        s => s.ticket_number.toLowerCase() === q.toLowerCase()
      )
      if (match) {
        setFoundSale(match)
        setChecked(new Set())
        setReturnQty(new Map())
        setStep('select')
      } else {
        setSearchErr(`No se encontró la venta "${q}". Verifica el número de ticket.`)
      }
    } catch {
      setSearchErr('Error al buscar. Intenta de nuevo.')
    } finally {
      setSearching(false)
    }
  }

  function toggleItem(productId: number, qty: number | string) {
    const soldQty = Number(qty)
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
        setReturnQty(m => {
          const nm = new Map(m)
          if (!nm.has(productId)) nm.set(productId, String(soldQty))
          return nm
        })
      }
      return next
    })
  }

  function setQty(productId: number, val: string) {
    setReturnQty(prev => new Map(prev).set(productId, val))
  }

  const checkedItems = foundSale?.items.filter(it => checked.has(it.product_id)) ?? []
  const canSubmit    = checkedItems.length > 0 && reason.trim().length >= 3 &&
    checkedItems.every(it => {
      const q = parseFloat(returnQty.get(it.product_id) ?? '0')
      return q > 0 && q <= Number(it.quantity)
    })

  const returnTotal = checkedItems.reduce((s, it) => {
    const q    = parseFloat(returnQty.get(it.product_id) ?? '0') || 0
    const p    = Number(it.price_per_unit_usd) || 0
    return s + q * p
  }, 0)

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
          items: checkedItems.map(it => ({
            product_id: it.product_id,
            qty:        parseFloat(returnQty.get(it.product_id) ?? '1'),
            price_usd:  Number(it.price_per_unit_usd) || 0,
          })),
        }),
      })
      const data = await res.json() as { ok?: boolean; return?: ReturnRecord; error?: string }
      if (res.ok && data.return) {
        setHistory(prev => [data.return!, ...prev])
        setStep('done')
        toast('Devolución registrada — stock actualizado', 'success')
      } else {
        toast(data.error ?? 'Error al registrar devolución', 'error')
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
                  const isChecked = checked.has(it.product_id)
                  const soldQty   = Number(it.quantity)
                  const qtyVal    = returnQty.get(it.product_id) ?? String(soldQty)
                  const maxQty    = soldQty
                  return (
                    <div key={it.product_id}
                      className={`${styles.selectRow} ${isChecked ? styles.selectRowActive : ''}`}>
                      <label className={styles.checkLabel}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={isChecked}
                          onChange={() => toggleItem(it.product_id, it.quantity)}
                          aria-label={`Devolver ${it.product_name}`}
                        />
                        <span className={styles.itemProductName}>{it.product_name}</span>
                        <span className={styles.itemQtySold}>vendido: {soldQty}</span>
                      </label>
                      {isChecked && (
                        <div className={styles.returnQtyWrap}>
                          <span className={styles.returnQtyLabel}>Devolver:</span>
                          <input
                            type="number"
                            className={styles.returnQtyInput}
                            value={qtyVal}
                            onChange={e => setQty(it.product_id, e.target.value)}
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
                  <strong>${returnTotal.toFixed(2)}</strong>
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
                  <th className={styles.th}>Motivo</th>
                  <th className={styles.th}>Estado</th>
                  <th className={`${styles.th} ${styles.thNum}`}>Total</th>
                  <th className={styles.th}>Hace</th>
                </tr>
              </thead>
              <tbody>
                {history.map(r => (
                  <tr key={r.id} className={styles.tr}>
                    <td className={styles.td}>
                      <span className={styles.ticketRef}>
                        {r.sale?.ticket_number ?? '—'}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.reasonText}>{r.reason}</span>
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.statusChip} ${r.status === 'approved' ? styles.statusApproved : r.status === 'rejected' ? styles.statusRejected : styles.statusPending}`}>
                        {r.status === 'approved' ? 'Aprobada' : r.status === 'rejected' ? 'Rechazada' : 'Pendiente'}
                      </span>
                    </td>
                    <td className={`${styles.td} ${styles.tdNum}`}>
                      <span className={styles.usd}>${r.total_usd.toFixed(2)}</span>
                      <span className={styles.bs}>Bs.&nbsp;{r.total_bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.muted}>{timeAgo(r.created_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
