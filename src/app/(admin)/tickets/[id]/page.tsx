'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import adminStyles from '../../admin.module.css'
import styles from './ticketDetail.module.css'

type TicketCategory = 'billing' | 'technical' | 'general'
type TicketStatus   = 'open' | 'answered' | 'closed'

interface TicketDetail {
  id:            number
  subject:       string
  category:      TicketCategory
  status:        TicketStatus
  business_name: string
  message:       string
  created_at:    string
  reply:         string | null
}

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  billing:   'Facturación',
  technical: 'Técnico',
  general:   'General',
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  open:     'Abierto',
  answered: 'Respondido',
  closed:   'Cerrado',
}

function categoryBadgeClass(category: TicketCategory, s: Record<string, string>) {
  switch (category) {
    case 'billing':   return s.badgeTrial
    case 'technical': return s.badgeInfo
    default:           return s.badgeInactive
  }
}

function statusBadgeClass(status: TicketStatus, s: Record<string, string>) {
  switch (status) {
    case 'open':     return s.badgeDanger
    case 'answered': return s.badgeTrial
    default:          return s.badgeActive
  }
}

type LoadState = 'loading' | 'error' | 'ready' | 'notfound'

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>()
  const { toast } = useToast()

  const [loadState, setLoadState]   = useState<LoadState>('loading')
  const [ticket, setTicket]         = useState<TicketDetail | null>(null)
  const [replyText, setReplyText]   = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [sending, setSending]       = useState(false)
  const [closing, setClosing]       = useState(false)

  const fetchTicket = useCallback(async () => {
    setLoadState('loading')
    try {
      const res = await fetch(`/api/admin/tickets/${params.id}`)
      if (res.status === 404) { setLoadState('notfound'); return }
      if (!res.ok) { setLoadState('error'); return }
      const body = await res.json() as { ok: boolean; ticket: TicketDetail }
      setTicket(body.ticket)
      setReplyText(body.ticket.reply ?? '')
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }, [params.id])

  useEffect(() => { void fetchTicket() }, [fetchTicket])

  async function handleAiSuggest() {
    if (!ticket) return
    setSuggesting(true)
    try {
      const res = await fetch(`/api/admin/tickets/${ticket.id}/ai-suggest`, { method: 'POST' })
      if (!res.ok) { toast('No se pudo generar la sugerencia.', 'error'); return }
      const body = await res.json() as { ok: boolean; suggestion: string }
      setReplyText(body.suggestion)
    } catch {
      toast('Error de conexión al generar la sugerencia.', 'error')
    } finally {
      setSuggesting(false)
    }
  }

  async function handleSendReply() {
    if (!ticket || !replyText.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/admin/tickets/${ticket.id}/reply`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reply: replyText.trim() }),
      })
      if (!res.ok) { toast('Error al enviar la respuesta.', 'error'); return }
      toast('Respuesta enviada.', 'success')
      void fetchTicket()
    } catch {
      toast('Error de conexión.', 'error')
    } finally {
      setSending(false)
    }
  }

  async function handleClose() {
    if (!ticket) return
    setClosing(true)
    try {
      const res = await fetch(`/api/admin/tickets/${ticket.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'closed' }),
      })
      if (!res.ok) { toast('Error al cerrar el ticket.', 'error'); return }
      toast('Ticket cerrado.', 'success')
      void fetchTicket()
    } catch {
      toast('Error de conexión.', 'error')
    } finally {
      setClosing(false)
    }
  }

  if (loadState === 'loading') {
    return <div className={adminStyles.emptyState}>Cargando...</div>
  }

  if (loadState === 'error' || loadState === 'notfound' || !ticket) {
    return (
      <div>
        <Link href="/tickets" className={styles.backLink}>
          <ArrowLeft size={14} aria-hidden="true" /> Volver a Tickets
        </Link>
        <div className={adminStyles.emptyState}>
          {loadState === 'notfound' ? 'Ticket no encontrado.' : 'No se pudo cargar el ticket. El endpoint puede no estar disponible todavía.'}
        </div>
      </div>
    )
  }

  return (
    <div>
      <Link href="/tickets" className={styles.backLink}>
        <ArrowLeft size={14} aria-hidden="true" /> Volver a Tickets
      </Link>

      <div className={styles.headerRow}>
        <h1 className={adminStyles.pageTitle}>{ticket.subject}</h1>
        <span className={`${adminStyles.badge} ${categoryBadgeClass(ticket.category, adminStyles)}`}>
          {CATEGORY_LABELS[ticket.category]}
        </span>
        <span className={`${adminStyles.badge} ${statusBadgeClass(ticket.status, adminStyles)}`}>
          {STATUS_LABELS[ticket.status]}
        </span>
      </div>
      <p className={styles.metaRow}>{ticket.business_name}</p>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Mensaje del cliente</h2>
        <div className={styles.messageCard}>{ticket.message}</div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Respuesta
          <button
            type="button"
            className={styles.aiSuggestBtn}
            onClick={() => void handleAiSuggest()}
            disabled={suggesting || ticket.status === 'closed'}
          >
            {suggesting
              ? <Loader2 size={14} className={styles.spinning} aria-hidden="true" />
              : <Sparkles size={14} aria-hidden="true" />}
            {suggesting ? 'Generando...' : 'Generar sugerencia'}
          </button>
        </h2>
        <textarea
          className={styles.textarea}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Escribe la respuesta para el negocio..."
          disabled={ticket.status === 'closed'}
        />
        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void handleSendReply()}
            disabled={sending || !replyText.trim() || ticket.status === 'closed'}
          >
            {sending ? 'Enviando...' : 'Enviar respuesta'}
          </button>
          {ticket.status !== 'closed' && (
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => void handleClose()}
              disabled={closing}
            >
              {closing ? 'Cerrando...' : 'Cerrar ticket'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
