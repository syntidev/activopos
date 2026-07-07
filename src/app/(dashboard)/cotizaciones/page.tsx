'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Plus, FileText, X, Search, Calendar, Check,
  User, ChevronRight, Package, FileDown,
} from 'lucide-react'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import styles from './cotizaciones.module.css'

/* ── Types ── */

interface Client { id: number; name: string; phone?: string | null }

interface Product {
  id: number; name: string;
  base_unit_label: string; sale_mode: string;
  price_per_unit_usd: number | null;
}

interface Quotation {
  id: number; number: string; status: string;
  total_usd: number; total_bs: number; rate_used: number;
  created_at: string; valid_until: string | null;
  notes: string | null;
  client: { id: number; name: string; phone: string | null } | null;
  items: Array<{
    id?: number; product_id?: number | null;
    name: string; qty: number; price_usd: number; total_usd?: number;
  }>;
}

/* ── Status helpers ── */

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviada', accepted: 'Aceptada',
  rejected: 'Rechazada', expired: 'Vencida',
}

function statusClass(status: string) {
  switch (status) {
    case 'draft':    return styles.statusDraft
    case 'sent':     return styles.statusSent
    case 'accepted': return styles.statusAccepted
    case 'rejected': return styles.statusRejected
    case 'expired':  return styles.statusExpired
    default:         return styles.statusDraft
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: '2-digit' })
}

/* ── Item form row type ── */
type ItemForm = { name: string; qty: string; price: string; product_id?: number }

/* ── Create Modal ── */

interface CreateModalProps {
  onClose: () => void
  onCreated: (q: Quotation) => void
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const { toast }   = useToast()
  const inputRef    = useRef<HTMLInputElement>(null)

  // Client search
  const [clientSearch, setClientSearch]   = useState('')
  const [clientSugg, setClientSugg]       = useState<Client[]>([])
  const [showClientDD, setShowClientDD]   = useState(false)
  const [selClient, setSelClient]         = useState<Client | null>(null)

  // Product search
  const [productSearch, setProductSearch] = useState('')
  const [productSugg, setProductSugg]     = useState<Product[]>([])
  const [showProductDD, setShowProductDD] = useState(false)

  // Items
  const [items, setItems]       = useState<ItemForm[]>([])
  const [notes, setNotes]       = useState('')
  const [validUntil, setValid]  = useState('')
  const [saving, setSaving]     = useState(false)

  // Client typeahead
  useEffect(() => {
    if (clientSearch.length < 2) { setClientSugg([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/clients?search=${encodeURIComponent(clientSearch)}&limit=5`)
        if (r.ok) { const d = await r.json() as { clients?: Client[] }; setClientSugg(d.clients ?? []) }
      } catch { /* ignore */ }
    }, 240)
    return () => clearTimeout(t)
  }, [clientSearch])

  // Product typeahead
  useEffect(() => {
    if (productSearch.length < 2) { setProductSugg([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/products/search?q=${encodeURIComponent(productSearch)}&limit=6`)
        if (r.ok) { const d = await r.json() as { products?: Product[] }; setProductSugg(d.products ?? []) }
      } catch { /* ignore */ }
    }, 240)
    return () => clearTimeout(t)
  }, [productSearch])

  function selectClient(c: Client) {
    setSelClient(c)
    setClientSearch('')
    setClientSugg([])
    setShowClientDD(false)
  }

  function addProduct(p: Product) {
    setItems(prev => [...prev, {
      name: p.name,
      qty: '1',
      price: p.price_per_unit_usd?.toFixed(2) ?? '0',
      product_id: p.id,
    }])
    setProductSearch('')
    setProductSugg([])
    setShowProductDD(false)
  }

  function addFreeItem() {
    setItems(prev => [...prev, { name: '', qty: '1', price: '0' }])
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)) }

  function updateItem(i: number, field: keyof ItemForm, val: string) {
    setItems(prev => prev.map((x, idx) => idx === i ? { ...x, [field]: val } : x))
  }

  const subtotal   = items.reduce((s, it) =>
    s + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), 0)
  const canSubmit  = items.length > 0 &&
    items.every(it => it.name.trim() && (parseFloat(it.qty) || 0) > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:   selClient?.id,
          notes:       notes.trim() || undefined,
          valid_until: validUntil || undefined,
          items: items.map(it => ({
            product_id: it.product_id,
            name:       it.name.trim(),
            qty:        parseFloat(it.qty),
            price_usd:  parseFloat(it.price) || 0,
          })),
        }),
      })
      const data = await res.json() as { ok?: boolean; quotation?: Quotation; error?: string }
      if (res.ok && data.quotation) {
        onCreated(data.quotation)
        toast(`Cotización ${data.quotation.number} creada`, 'success')
      } else {
        toast(data.error ?? 'Error al crear cotización', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}
        role="dialog" aria-modal="true" aria-label="Nueva cotización"
      >
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
          onClick={e => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Nueva cotización</h2>
            <button className={styles.closeBtn} onClick={onClose} disabled={saving}
              type="button" aria-label="Cerrar">
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className={styles.modalForm} noValidate>
            {/* Row: Client + Date */}
            <div className={styles.fieldRow2}>
              {/* Client */}
              <div className={styles.field}>
                <label className={styles.label}>
                  <User size={12} aria-hidden="true" />
                  Cliente <span className={styles.opt}>opcional</span>
                </label>
                {selClient ? (
                  <div className={styles.clientChip}>
                    <span>{selClient.name}</span>
                    <button type="button"
                      onClick={() => setSelClient(null)}
                      aria-label="Quitar cliente" className={styles.chipRemove}>
                      <X size={12} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className={styles.comboWrap}>
                    <input type="text" className={styles.input}
                      value={clientSearch}
                      onChange={e => { setClientSearch(e.target.value); setShowClientDD(true) }}
                      onFocus={() => clientSugg.length > 0 && setShowClientDD(true)}
                      onBlur={() => setTimeout(() => setShowClientDD(false), 180)}
                      placeholder="Buscar cliente…" autoComplete="off" />
                    {showClientDD && clientSugg.length > 0 && (
                      <ul className={styles.dropdown} role="listbox">
                        {clientSugg.map(c => (
                          <li key={c.id}>
                            <button type="button" className={styles.dropItem}
                              onMouseDown={() => selectClient(c)}>
                              <span>{c.name}</span>
                              {c.phone && <span className={styles.muted}>{c.phone}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Date */}
              <div className={styles.field}>
                <label htmlFor="quot-valid" className={styles.label}>
                  <Calendar size={12} aria-hidden="true" />
                  Válida hasta <span className={styles.opt}>opcional</span>
                </label>
                <input id="quot-valid" type="date" className={styles.input}
                  value={validUntil} onChange={e => setValid(e.target.value)} />
              </div>
            </div>

            {/* Products */}
            <div className={styles.field}>
              <label className={styles.label}>
                <Package size={12} aria-hidden="true" />
                Ítems *
              </label>

              <div className={styles.comboWrap}>
                <Search size={13} className={styles.searchIcon} aria-hidden="true" />
                <input type="text" className={`${styles.input} ${styles.inputPl}`}
                  value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setShowProductDD(true) }}
                  onFocus={() => productSugg.length > 0 && setShowProductDD(true)}
                  onBlur={() => setTimeout(() => setShowProductDD(false), 180)}
                  placeholder="Buscar producto del catálogo…" autoComplete="off" />
                {showProductDD && productSugg.length > 0 && (
                  <ul className={styles.dropdown} role="listbox">
                    {productSugg.map(p => (
                      <li key={p.id}>
                        <button type="button" className={styles.dropItem}
                          onMouseDown={() => addProduct(p)}>
                          <span>{p.name}</span>
                          {p.price_per_unit_usd != null &&
                            <span className={styles.muted}>${p.price_per_unit_usd.toFixed(2)}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {items.length > 0 && (
                <div className={styles.itemsTable}>
                  <div className={styles.itemsHead}>
                    <span className={styles.colName}>Descripción</span>
                    <span className={styles.colNum}>Cant.</span>
                    <span className={styles.colNum}>Precio</span>
                    <span className={styles.colNum}>Total</span>
                    <span />
                  </div>
                  {items.map((it, i) => (
                    <div key={i} className={styles.itemLine}>
                      <input type="text" ref={it.name === '' ? inputRef : undefined}
                        className={`${styles.input} ${styles.colName}`}
                        value={it.name}
                        onChange={e => updateItem(i, 'name', e.target.value)}
                        placeholder="Descripción" required />
                      <input type="number" className={`${styles.input} ${styles.colNum}`}
                        value={it.qty}
                        onChange={e => updateItem(i, 'qty', e.target.value)}
                        min="0.001" step="any" placeholder="0" required />
                      <input type="number" className={`${styles.input} ${styles.colNum}`}
                        value={it.price}
                        onChange={e => updateItem(i, 'price', e.target.value)}
                        min="0" step="0.01" placeholder="0.00" required />
                      <span className={`${styles.colNum} ${styles.itemTotal}`}>
                        ${((parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0)).toFixed(2)}
                      </span>
                      <button type="button" className={styles.removeBtn}
                        onClick={() => removeItem(i)}
                        aria-label={`Eliminar ${it.name || 'ítem'}`}>
                        <X size={13} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  <div className={styles.subtotalRow}>
                    Total: <strong>${subtotal.toFixed(2)}</strong>
                  </div>
                </div>
              )}

              <button type="button" className={styles.addFreeBtn} onClick={addFreeItem}>
                <Plus size={12} aria-hidden="true" />
                Agregar ítem libre
              </button>
            </div>

            {/* Notes */}
            <div className={styles.field}>
              <label htmlFor="quot-notes" className={styles.label}>
                Notas <span className={styles.opt}>opcional</span>
              </label>
              <textarea id="quot-notes" className={styles.textarea}
                value={notes} onChange={e => setNotes(e.target.value)}
                maxLength={2000} rows={2}
                placeholder="Condiciones de pago, observaciones…" />
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={styles.btnSec} onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className={styles.btnPri} disabled={saving || !canSubmit}>
                {saving && <span className={styles.spinner} aria-hidden="true" />}
                {saving ? 'Creando…' : 'Crear cotización'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ── Main content ── */

function CotizacionesContent() {
  const { toast }   = useToast()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading]       = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [converting, setConverting] = useState<number | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const r = await fetch('/api/quotations?limit=50')
      if (r.ok) {
        const d = await r.json() as { quotations?: Quotation[] }
        setQuotations(d.quotations ?? [])
      }
    } catch {
      toast('Error al cargar cotizaciones', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleConvert(q: Quotation) {
    setConverting(q.id)
    try {
      const r = await fetch(`/api/quotations/${q.id}/convert`, { method: 'POST' })
      if (r.ok) {
        const d = await r.json() as { ok: boolean; ticket_number?: string }
        setQuotations(prev => prev.map(x => x.id === q.id ? { ...x, status: 'converted' } : x))
        toast(`Cotización ${q.number} convertida${d.ticket_number ? ` — Ticket #${d.ticket_number}` : ''}`, 'success')
      } else {
        const d = await r.json() as { error?: string }
        toast(d.error ?? 'Error al convertir', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setConverting(null)
    }
  }

  function handleCreated(q: Quotation) {
    setQuotations(prev => [q, ...prev])
    setShowCreate(false)
  }

  return (
    <div className={`${styles.page} page-container`}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Cotizaciones</h1>
          <p className={styles.pageSubtitle}>Presupuestos formales para tus clientes</p>
        </div>
        <button className={styles.createBtn} onClick={() => setShowCreate(true)} type="button">
          <Plus size={14} aria-hidden="true" />
          Nueva cotización
        </button>
      </div>

      {loading ? (
        <div className={styles.skeletonWrap}>
          {[0, 1, 2, 3].map(i => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : quotations.length === 0 ? (
        <div className={styles.empty}>
          <FileText size={32} strokeWidth={1.25} aria-hidden="true" />
          <p>Sin cotizaciones aún</p>
          <button className={styles.emptyCreateBtn} onClick={() => setShowCreate(true)} type="button">
            <Plus size={13} aria-hidden="true" />
            Crear primera cotización
          </button>
        </div>
      ) : (
        <section className={styles.section}>
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label="Cotizaciones">
              <thead className={styles.thead}>
                <tr>
                  <th className={styles.th}>Número</th>
                  <th className={`${styles.th} ${styles.thHidden}`}>Cliente</th>
                  <th className={`${styles.th} ${styles.thHidden}`}>Ítems</th>
                  <th className={`${styles.th} ${styles.thNum}`}>Total</th>
                  <th className={styles.th}>Estado</th>
                  <th className={`${styles.th} ${styles.thHidden}`}>Fecha</th>
                  <th className={styles.th} />
                </tr>
              </thead>
              <tbody>
                {quotations.map(q => (
                  <tr key={q.id} className={styles.tr}>
                    <td className={styles.td} data-label="Número">
                      <span className={styles.quotNum}>{q.number}</span>
                    </td>
                    <td className={`${styles.td} ${styles.tdHidden}`} data-label="Cliente">
                      {q.client
                        ? <span className={styles.clientName}>{q.client.name}</span>
                        : <span className={styles.muted}>—</span>}
                    </td>
                    <td className={`${styles.td} ${styles.tdHidden}`} data-label="Ítems">
                      <span className={styles.muted}>{q.items.length} ítem{q.items.length !== 1 ? 's' : ''}</span>
                    </td>
                    <td className={`${styles.td} ${styles.tdNum}`} data-label="Total">
                      <span className={styles.usd}>${q.total_usd.toFixed(2)}</span>
                      <span className={styles.bs}>
                        Bs.&nbsp;{q.total_bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className={styles.td} data-label="Estado">
                      <span className={`${styles.chip} ${statusClass(q.status)}`}>
                        {STATUS_LABELS[q.status] ?? q.status}
                      </span>
                    </td>
                    <td className={`${styles.td} ${styles.tdHidden}`} data-label="Fecha">
                      <span className={styles.muted}>{fmtDate(q.created_at)}</span>
                    </td>
                    <td className={`${styles.td} ${styles.tdAction}`} data-label="Acciones">
                      <div className={styles.actionsRow}>
                        {q.status !== 'expired' && (
                          <button
                            className={styles.pdfBtn}
                            onClick={() => window.open(`/api/quotations/${q.id}/pdf`, '_blank')}
                            type="button"
                            aria-label={`Descargar PDF de cotización ${q.number}`}
                          >
                            <FileDown size={14} aria-hidden="true" />
                          </button>
                        )}
                        {q.status === 'draft' && (
                          <button
                            className={styles.convertBtn}
                            onClick={() => handleConvert(q)}
                            disabled={converting === q.id}
                            type="button"
                            aria-label={`Convertir cotización ${q.number} a venta`}
                          >
                            {converting === q.id
                              ? <span className={styles.spinnerSm} aria-hidden="true" />
                              : <Check size={12} aria-hidden="true" />}
                            Convertir a venta
                            {converting !== q.id && <ChevronRight size={12} aria-hidden="true" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}

export default function CotizacionesPage() {
  return (
    <ToastProvider>
      <CotizacionesContent />
    </ToastProvider>
  )
}
