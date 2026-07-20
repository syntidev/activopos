'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, FileText, X, Check, ChevronRight, FileDown,
  Send, Trash2, MessageCircle, Pencil, MoreHorizontal,
} from 'lucide-react'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { normalizePhone } from '@/lib/utils'
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

/* ── Menú de acciones secundarias ── */

interface MenuAction {
  key:     string
  label:   string
  icon:    ReactNode
  run:     () => void
  danger?: boolean
}

/* ── Status helpers ── */

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviada', accepted: 'Aceptada',
  rejected: 'Rechazada', expired: 'Vencida', converted: 'Cobrada',
}

// Orden del filtro superior. '' = todas.
const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '',          label: 'Todas' },
  { value: 'draft',     label: 'Borrador' },
  { value: 'sent',      label: 'Enviada' },
  { value: 'accepted',  label: 'Aceptada' },
  { value: 'rejected',  label: 'Rechazada' },
  { value: 'expired',   label: 'Vencida' },
  { value: 'converted', label: 'Cobrada' },
]

function statusClass(status: string) {
  switch (status) {
    case 'draft':     return styles.statusDraft
    case 'sent':      return styles.statusSent
    case 'accepted':  return styles.statusAccepted
    case 'rejected':  return styles.statusRejected
    case 'expired':   return styles.statusExpired
    case 'converted': return styles.statusConverted
    default:          return styles.statusDraft
  }
}

/* ── WhatsApp ──
 * El PDF exige sesión (pdf/route.ts:9 → getAuthenticatedTenant), así que NO hay
 * URL pública que mandarle al cliente: un enlace ahí le daría 401. El mensaje
 * va sin enlace y el negocio adjunta el PDF a mano. Para incluir el enlace hace
 * falta una ruta pública con token, que hoy no existe.
 */
function whatsappUrl(q: Quotation): string {
  const phone = normalizePhone(q.client?.phone ?? '')
  const validez = q.valid_until
    ? `\nVálida hasta: ${fmtDate(q.valid_until)}`
    : ''
  const msg =
    `Hola ${q.client?.name ?? ''}, te comparto la cotización ${q.number}:\n` +
    `Total: $${q.total_usd.toFixed(2)} USD${validez}\n` +
    `Te envío el PDF por este chat.`
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: '2-digit' })
}

/* ── Main content ── */

function CotizacionesContent() {
  const { toast }   = useToast()
  const router      = useRouter()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState('')
  const [busy, setBusy]             = useState<number | null>(null)
  const [menuId, setMenuId]         = useState<number | null>(null)

  // Un solo listener global mientras haya menú abierto: click afuera o Escape
  // lo cierran. Sin esto el menú queda pegado al navegar por la tabla.
  useEffect(() => {
    if (menuId === null) return
    const close = () => setMenuId(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuId(null) }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuId])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const qs = filter ? `?status=${filter}&limit=50` : '?limit=50'
      const r  = await fetch(`/api/quotations${qs}`)
      if (r.ok) {
        const d = await r.json() as { quotations?: Quotation[] }
        setQuotations(d.quotations ?? [])
      }
    } catch {
      toast('Error al cargar cotizaciones', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast, filter])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Convertir NO cobra: crea un ticket abierto en el POS y manda al cajero allá.
  // La cotización queda en 'accepted' hasta que el POS confirme el pago.
  async function handleConvert(q: Quotation) {
    setBusy(q.id)
    try {
      const r = await fetch(`/api/quotations/${q.id}/convert`, { method: 'POST' })
      const d = await r.json() as { ok?: boolean; draft_id?: number; ticket_number?: string; error?: string }
      if (r.ok && d.draft_id) {
        toast(`Ticket ${d.ticket_number ?? ''} abierto en el POS`, 'success')
        router.push(`/pos?draft=${d.draft_id}`)
      } else {
        toast(d.error ?? 'Error al convertir', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function handleStatus(q: Quotation, status: string, label: string) {
    setBusy(q.id)
    try {
      const r = await fetch(`/api/quotations/${q.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      })
      const d = await r.json() as { ok?: boolean; error?: string }
      if (r.ok) {
        setQuotations(prev => prev.map(x => x.id === q.id ? { ...x, status } : x))
        toast(`Cotización ${q.number} marcada como ${label}`, 'success')
      } else {
        toast(d.error ?? 'Error al cambiar el estado', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(q: Quotation) {
    if (!confirm(`¿Eliminar la cotización ${q.number}? Esta acción no se puede deshacer.`)) return
    setBusy(q.id)
    try {
      const r = await fetch(`/api/quotations/${q.id}`, { method: 'DELETE' })
      const d = await r.json() as { ok?: boolean; error?: string }
      if (r.ok) {
        setQuotations(prev => prev.filter(x => x.id !== q.id))
        toast(`Cotización ${q.number} eliminada`, 'success')
      } else {
        toast(d.error ?? 'Error al eliminar', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setBusy(null)
    }
  }

  // Acciones que van al menú "···". Aceptada/Rechazada viven en draft y sent
  // porque el flujo real no siempre pasa por "Enviada": el dueño acuerda de
  // palabra y marca Aceptada desde el borrador.
  function secondaryActions(q: Quotation): MenuAction[] {
    const acts: MenuAction[] = []
    if (q.status === 'draft') {
      acts.push({
        key: 'send', label: 'Enviar',
        icon: <Send size={13} aria-hidden="true" />,
        run: () => handleStatus(q, 'sent', 'Enviada'),
      })
    }
    if (q.status === 'draft' || q.status === 'sent') {
      acts.push({
        key: 'accept', label: 'Aceptada',
        icon: <Check size={13} aria-hidden="true" />,
        run: () => handleStatus(q, 'accepted', 'Aceptada'),
      })
      acts.push({
        key: 'reject', label: 'Rechazada',
        icon: <X size={13} aria-hidden="true" />,
        run: () => handleStatus(q, 'rejected', 'Rechazada'),
      })
    }
    if (q.status === 'draft') {
      acts.push({
        key: 'delete', label: 'Eliminar', danger: true,
        icon: <Trash2 size={13} aria-hidden="true" />,
        run: () => handleDelete(q),
      })
    }
    return acts
  }

  return (
    <div className={`${styles.page} page-container`}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Cotizaciones</h1>
          <p className={styles.pageSubtitle}>Presupuestos formales para tus clientes</p>
        </div>
        <button className={styles.createBtn}
          onClick={() => router.push('/cotizaciones/nueva')} type="button">
          <Plus size={14} aria-hidden="true" />
          Nueva cotización
        </button>
      </div>

      <div className={styles.filterBar} role="group" aria-label="Filtrar por estado">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value || 'all'}
            type="button"
            className={`${styles.filterChip} ${filter === f.value ? styles.filterChipOn : ''}`}
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.skeletonWrap}>
          {[0, 1, 2, 3].map(i => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : quotations.length === 0 ? (
        <div className={styles.empty}>
          <FileText size={32} strokeWidth={1.25} aria-hidden="true" />
          <p>Sin cotizaciones aún</p>
          <button className={styles.emptyCreateBtn}
            onClick={() => router.push('/cotizaciones/nueva')} type="button">
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
                  <th className={`${styles.th} ${styles.colNumero}`}>Número</th>
                  <th className={styles.th}>Cliente</th>
                  <th className={`${styles.th} ${styles.thHidden}`}>Ítems</th>
                  <th className={`${styles.th} ${styles.thNum}`}>Total USD</th>
                  <th className={`${styles.th} ${styles.thNum} ${styles.thHidden}`}>Total Bs</th>
                  <th className={styles.th}>Estado</th>
                  <th className={`${styles.th} ${styles.thHidden}`}>Válida hasta</th>
                  <th className={`${styles.th} ${styles.thHidden}`}>Fecha</th>
                  <th className={styles.th} />
                </tr>
              </thead>
              <tbody>
                {quotations.map(q => (
                  <tr key={q.id} className={styles.tr}>
                    <td className={`${styles.td} ${styles.colNumero}`} data-label="Número">
                      <span className={styles.quotNum}>{q.number}</span>
                    </td>
                    <td className={styles.td} data-label="Cliente">
                      {q.client
                        ? <span className={styles.clientName}>{q.client.name}</span>
                        : <span className={styles.muted}>—</span>}
                    </td>
                    <td className={`${styles.td} ${styles.tdHidden}`} data-label="Ítems">
                      <span className={styles.muted}>{q.items.length} ítem{q.items.length !== 1 ? 's' : ''}</span>
                    </td>
                    <td className={`${styles.td} ${styles.tdNum}`} data-label="Total USD">
                      <span className={styles.usd}>${q.total_usd.toFixed(2)}</span>
                    </td>
                    <td className={`${styles.td} ${styles.tdNum} ${styles.tdHidden}`} data-label="Total Bs">
                      <span className={styles.bs}>
                        Bs.&nbsp;{q.total_bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className={styles.td} data-label="Estado">
                      <span className={`${styles.chip} ${statusClass(q.status)}`}>
                        {STATUS_LABELS[q.status] ?? q.status}
                      </span>
                    </td>
                    <td className={`${styles.td} ${styles.tdHidden}`} data-label="Válida hasta">
                      <span className={styles.muted}>
                        {q.valid_until ? fmtDate(q.valid_until) : '—'}
                      </span>
                    </td>
                    <td className={`${styles.td} ${styles.tdHidden}`} data-label="Fecha">
                      <span className={styles.muted}>{fmtDate(q.created_at)}</span>
                    </td>
                    <td className={`${styles.td} ${styles.tdAction}`} data-label="Acciones">
                      <div className={styles.actionsRow}>
                        {/* Primarios: lo que el dueño hace todos los días. El resto
                            vive en el menú "···" para que la fila no tenga 5 botones. */}
                        {q.status === 'draft' && (
                          <button
                            className={styles.miniBtn}
                            onClick={() => router.push(`/cotizaciones/${q.id}/editar`)}
                            disabled={busy === q.id}
                            type="button"
                            aria-label={`Editar cotización ${q.number}`}
                          >
                            <Pencil size={12} aria-hidden="true" />
                            Editar
                          </button>
                        )}

                        {q.status === 'accepted' && (
                          <button
                            className={styles.convertBtn}
                            onClick={() => handleConvert(q)}
                            disabled={busy === q.id}
                            type="button"
                            aria-label={`Cobrar cotización ${q.number}`}
                          >
                            {busy === q.id
                              ? <span className={styles.spinnerSm} aria-hidden="true" />
                              : <Check size={12} aria-hidden="true" />}
                            Cobrar
                            {busy !== q.id && <ChevronRight size={12} aria-hidden="true" />}
                          </button>
                        )}

                        {/* PDF y WhatsApp NO aparecen en borrador: todavía no es un
                            documento para mandarle al cliente. */}
                        {q.status !== 'draft' && (
                          <>
                            <button
                              className={styles.pdfBtn}
                              onClick={() => window.open(`/api/quotations/${q.id}/pdf`, '_blank')}
                              type="button"
                              aria-label={`Descargar PDF de cotización ${q.number}`}
                            >
                              <FileDown size={14} aria-hidden="true" />
                            </button>
                            <button
                              className={styles.waBtn}
                              onClick={() => window.open(whatsappUrl(q), '_blank', 'noopener')}
                              type="button"
                              aria-label={`Enviar cotización ${q.number} por WhatsApp`}
                              title={q.client?.phone
                                ? `Enviar a ${q.client.name}`
                                : 'Sin teléfono — WhatsApp abre sin destinatario'}
                            >
                              <MessageCircle size={14} aria-hidden="true" />
                            </button>
                          </>
                        )}

                        {secondaryActions(q).length > 0 && (
                          <div className={styles.menuWrap} onClick={e => e.stopPropagation()}>
                            <button
                              className={styles.menuBtn}
                              onClick={() => setMenuId(prev => prev === q.id ? null : q.id)}
                              disabled={busy === q.id}
                              type="button"
                              aria-haspopup="menu"
                              aria-expanded={menuId === q.id}
                              aria-label={`Más acciones para ${q.number}`}
                            >
                              <MoreHorizontal size={14} aria-hidden="true" />
                            </button>
                            {menuId === q.id && (
                              <ul className={styles.menu} role="menu">
                                {secondaryActions(q).map(a => (
                                  <li key={a.key} role="none">
                                    <button
                                      role="menuitem"
                                      type="button"
                                      className={`${styles.menuItem} ${a.danger ? styles.menuItemDanger : ''}`}
                                      onClick={() => { setMenuId(null); a.run() }}
                                    >
                                      {a.icon}
                                      {a.label}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
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
