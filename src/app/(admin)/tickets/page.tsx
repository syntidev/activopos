'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import adminStyles from '../admin.module.css'
import styles from './tickets.module.css'

type TicketCategory = 'billing' | 'technical' | 'general'
type TicketStatus   = 'open' | 'answered' | 'closed'

interface TicketRow {
  id:            number
  business_name: string
  subject:       string
  category:      TicketCategory
  status:        TicketStatus
  created_at:    string
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

function categoryBadgeClass(category: TicketCategory) {
  switch (category) {
    case 'billing':   return adminStyles.badgeTrial
    case 'technical': return adminStyles.badgeInfo
    default:           return adminStyles.badgeInactive
  }
}

function statusBadgeClass(status: TicketStatus) {
  switch (status) {
    case 'open':     return adminStyles.badgeDanger
    case 'answered': return adminStyles.badgeTrial
    default:          return adminStyles.badgeActive
  }
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1)  return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)   return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

type LoadState = 'loading' | 'error' | 'ready'

export default function TicketsPage() {
  const router = useRouter()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [tickets, setTickets]     = useState<TicketRow[]>([])
  const [status, setStatus]       = useState<TicketStatus | ''>('')
  const [category, setCategory]   = useState<TicketCategory | ''>('')

  const fetchTickets = useCallback(async () => {
    setLoadState('loading')
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (category) params.set('category', category)
      const res = await fetch(`/api/admin/tickets?${params.toString()}`)
      if (!res.ok) { setTickets([]); setLoadState('error'); return }
      const body = await res.json() as { ok: boolean; tickets: TicketRow[] }
      setTickets(body.tickets ?? [])
      setLoadState('ready')
    } catch {
      setTickets([])
      setLoadState('error')
    }
  }, [status, category])

  useEffect(() => { void fetchTickets() }, [fetchTickets])

  return (
    <div>
      <div className={adminStyles.pageHeader}>
        <h1 className={adminStyles.pageTitle}>Tickets de soporte</h1>
        <p className={adminStyles.pageSubtitle}>Consultas y reclamos reportados por los negocios</p>
      </div>

      <div className={adminStyles.tableWrap}>
        <div className={adminStyles.tableHeader}>
          <p className={adminStyles.tableTitle}>Todos los tickets</p>
          <div className={adminStyles.filterBar}>
            <select
              className={adminStyles.planSelect}
              value={status}
              onChange={(e) => setStatus(e.target.value as TicketStatus | '')}
              aria-label="Filtrar por estado"
            >
              <option value="">Todos los estados</option>
              {(Object.keys(STATUS_LABELS) as TicketStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <select
              className={adminStyles.planSelect}
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory | '')}
              aria-label="Filtrar por categoría"
            >
              <option value="">Todas las categorías</option>
              {(Object.keys(CATEGORY_LABELS) as TicketCategory[]).map(c => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
        </div>

        {loadState === 'loading' && <div className={adminStyles.emptyState}>Cargando...</div>}
        {loadState === 'error' && (
          <div className={adminStyles.emptyState}>
            No se pudo cargar tickets. El endpoint puede no estar disponible todavía.
          </div>
        )}
        {loadState === 'ready' && tickets.length === 0 && (
          <div className={adminStyles.emptyState}>
            {status || category ? 'Sin resultados para este filtro.' : 'Sin tickets registrados.'}
          </div>
        )}

        {loadState === 'ready' && tickets.length > 0 && (
          <table className={adminStyles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Negocio</th>
                <th>Asunto</th>
                <th>Categoría</th>
                <th>Estado</th>
                <th>Hace</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr
                  key={t.id}
                  className={styles.tableRowClickable}
                  onClick={() => router.push(`/tickets/${t.id}`)}
                >
                  <td className={adminStyles.tdName}>#{t.id}</td>
                  <td>{t.business_name}</td>
                  <td>{t.subject}</td>
                  <td><span className={`${adminStyles.badge} ${categoryBadgeClass(t.category)}`}>{CATEGORY_LABELS[t.category]}</span></td>
                  <td><span className={`${adminStyles.badge} ${statusBadgeClass(t.status)}`}>{STATUS_LABELS[t.status]}</span></td>
                  <td className={styles.timeAgo}>{timeAgo(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
