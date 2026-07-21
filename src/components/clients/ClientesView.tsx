'use client'

import { useState, useMemo } from 'react'
import { Users, Pencil, History, Trash2, Search, UserPlus, ChevronUp, ChevronDown, Wallet, BadgeDollarSign } from 'lucide-react'
import { normalizePhone } from '@/lib/utils'
import { buildPaymentMessage } from '@/lib/payments'
import { Button }      from '@/components/ui/Button'
import { Badge }       from '@/components/ui/Badge'
import { EmptyState }  from '@/components/ui/EmptyState'
import { useToast }    from '@/components/ui/Toast'
import { ClienteFormModal }      from './ClienteFormModal'
import { ClienteHistorialModal } from './ClienteHistorialModal'
import type { ClientRecord } from '@/types'
import styles from './ClientesView.module.css'

interface ClientesViewProps {
  initialClients: ClientRecord[]
}

export function ClientesView({ initialClients }: ClientesViewProps) {
  const { toast } = useToast()

  const [clients, setClients]         = useState<ClientRecord[]>(initialClients)
  const [search, setSearch]           = useState('')
  const [formOpen, setFormOpen]       = useState(false)
  const [editTarget, setEditTarget]   = useState<ClientRecord | null>(null)
  const [historialId, setHistorialId] = useState<number | null>(null)
  const [deleting, setDeleting]       = useState<number | null>(null)

  type ClientSortKey = 'name' | 'balance'
  type SortDir = 'asc' | 'desc'
  const [sortKey, setSortKey] = useState<ClientSortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: ClientSortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  /* ── Client-side search + sort ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = q
      ? clients.filter(c =>
          c.name.toLowerCase().includes(q) ||
          (c.phone  ?? '').toLowerCase().includes(q) ||
          (c.cedula ?? '').toLowerCase().includes(q)
        )
      : clients

    if (sortKey) {
      list = [...list].sort((a, b) => {
        let cmp = 0
        if (sortKey === 'name')    cmp = a.name.localeCompare(b.name)
        if (sortKey === 'balance') cmp = a.pending_balance_usd - b.pending_balance_usd
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return list
  }, [clients, search, sortKey, sortDir])

  /* ── CRUD handlers ── */
  const handleCreated = (c: ClientRecord) => {
    setClients((prev) =>
      [...prev, c].sort((a, b) => a.name.localeCompare(b.name))
    )
    setFormOpen(false)
    toast('Cliente creado correctamente.', 'success')
  }

  const handleUpdated = (c: ClientRecord) => {
    setClients((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...c } : x)))
    setEditTarget(null)
    toast('Cliente actualizado.', 'success')
  }

  // Abre WhatsApp con datos de cobro (modo 'datos') o recordatorio de deuda
  // (modo 'deuda'). Trae cobro_data del negocio bajo demanda: no hace falta
  // cargarlo para toda la tabla si el dueño abre una sola conversación.
  const handleCobroMessage = async (client: ClientRecord, mode: 'datos' | 'deuda') => {
    try {
      const res = await fetch('/api/payment-methods/cobro')
      if (!res.ok) { toast('No se pudieron cargar tus datos de cobro.', 'error'); return }
      const data = await res.json() as {
        cobro_data: unknown; acceptsCash?: boolean
      }
      const msg = buildPaymentMessage(data.cobro_data as Record<string, unknown> | null, {
        mode,
        clientName:  client.name,
        cxcUsd:      client.pending_balance_usd,
        acceptsCash: data.acceptsCash,
      })
      const phone = normalizePhone(client.phone ?? '')
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
    } catch {
      toast('Error al generar el mensaje.', 'error')
    }
  }

  const handleDelete = async (client: ClientRecord) => {
    if (client.pending_balance_usd > 0) {
      toast('No se puede eliminar: el cliente tiene saldo pendiente.', 'error')
      return
    }
    if (!confirm(`¿Eliminar a ${client.name}? Esta acción no se puede deshacer.`)) return

    setDeleting(client.id)
    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        toast(body.error ?? 'Error al eliminar.', 'error')
        return
      }
      setClients((prev) => prev.filter((c) => c.id !== client.id))
      toast('Cliente eliminado.', 'info')
    } catch {
      toast('Error de conexión.', 'error')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      {/* Page header */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Directorio de Clientes</h2>
          <p className={styles.subtitle}>
            Gestiona la información y datos de contacto de tus clientes.
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<UserPlus size={16} strokeWidth={2} />}
          onClick={() => { setEditTarget(null); setFormOpen(true) }}
        >
          Nuevo Cliente
        </Button>
      </div>

      {/* Search */}
      <div className={styles.searchRow}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Nombre, teléfono o cédula…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar clientes"
          />
        </div>
        <p className={styles.count} aria-live="polite">
          {filtered.length} {filtered.length === 1 ? 'cliente' : 'clientes'}
        </p>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className={styles.emptyWrapper}>
          <EmptyState
            icon={Users}
            title={search ? 'Sin resultados' : 'Sin clientes'}
            description={
              search
                ? `No hay clientes que coincidan con "${search}".`
                : 'Agrega tu primer cliente con el botón "Nuevo Cliente".'
            }
            action={
              !search ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<UserPlus size={14} strokeWidth={2} />}
                  onClick={() => { setEditTarget(null); setFormOpen(true) }}
                >
                  Nuevo Cliente
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <div className={styles.scrollArea}>
            <table className={styles.table}>
              <thead className={styles.thead}>
                <tr>
                  <th className={`${styles.th} ${styles.thHidden}`}>Cédula / RIF</th>
                  <th className={styles.th}>
                    <button
                      type="button"
                      className={styles.sortBtn}
                      onClick={() => handleSort('name')}
                      aria-label="Ordenar por nombre"
                    >
                      Nombre
                      {sortKey === 'name'
                        ? sortDir === 'asc'
                          ? <ChevronUp size={12} aria-hidden="true" />
                          : <ChevronDown size={12} aria-hidden="true" />
                        : <span className={styles.sortInactive} aria-hidden="true" />
                      }
                    </button>
                  </th>
                  <th className={styles.th}>Teléfono</th>
                  <th className={`${styles.th} ${styles.thRight}`}>
                    <button
                      type="button"
                      className={`${styles.sortBtn} ${styles.sortBtnRight}`}
                      onClick={() => handleSort('balance')}
                      aria-label="Ordenar por saldo pendiente"
                    >
                      Saldo Pendiente
                      {sortKey === 'balance'
                        ? sortDir === 'asc'
                          ? <ChevronUp size={12} aria-hidden="true" />
                          : <ChevronDown size={12} aria-hidden="true" />
                        : <span className={styles.sortInactive} aria-hidden="true" />
                      }
                    </button>
                  </th>
                  <th className={`${styles.th} ${styles.thRight} ${styles.thHidden}`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr
                    key={client.id}
                    className={styles.row}
                    onClick={() => setHistorialId(client.id)}
                  >
                    <td className={`${styles.td} ${styles.tdHidden}`} data-label="Cédula / RIF">
                      <span className={styles.cedula}>{client.cedula ?? '—'}</span>
                    </td>
                    <td className={styles.td} data-label="Nombre">
                      <span className={styles.name}>{client.name}</span>
                      {client.email && (
                        <span className={styles.email}>{client.email}</span>
                      )}
                    </td>
                    <td className={styles.td} data-label="Teléfono">
                      <span className={styles.phone}>{client.phone ?? '—'}</span>
                    </td>
                    <td className={`${styles.td} ${styles.tdRight}`} data-label="Saldo Pendiente">
                      {client.pending_balance_usd > 0 ? (
                        <Badge variant="warning">
                          ${client.pending_balance_usd.toFixed(2)}
                        </Badge>
                      ) : (
                        <Badge variant="neutral">$0.00</Badge>
                      )}
                    </td>
                    <td className={`${styles.td} ${styles.tdRight} ${styles.tdHidden}`} data-label="Acciones">
                      <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => handleCobroMessage(client, 'datos')}
                          title="Enviar datos de cobro"
                          aria-label={`Enviar datos de cobro a ${client.name}`}
                        >
                          <Wallet size={15} strokeWidth={1.75} />
                        </button>
                        {client.pending_balance_usd > 0 && (
                          <button
                            className={styles.actionBtn}
                            onClick={() => handleCobroMessage(client, 'deuda')}
                            title="Cobrar deuda"
                            aria-label={`Cobrar deuda a ${client.name}`}
                          >
                            <BadgeDollarSign size={15} strokeWidth={1.75} />
                          </button>
                        )}
                        <button
                          className={styles.actionBtn}
                          onClick={() => setHistorialId(client.id)}
                          title="Ver historial"
                          aria-label={`Ver historial de ${client.name}`}
                        >
                          <History size={15} strokeWidth={1.75} />
                        </button>
                        <button
                          className={styles.actionBtn}
                          onClick={() => { setEditTarget(client); setFormOpen(true) }}
                          title="Editar"
                          aria-label={`Editar ${client.name}`}
                        >
                          <Pencil size={15} strokeWidth={1.75} />
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.actionDanger}`}
                          onClick={() => handleDelete(client)}
                          disabled={deleting === client.id}
                          title="Eliminar"
                          aria-label={`Eliminar ${client.name}`}
                        >
                          <Trash2 size={15} strokeWidth={1.75} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <ClienteFormModal
        open={formOpen}
        client={editTarget}
        onClose={() => { setFormOpen(false); setEditTarget(null) }}
        onCreated={handleCreated}
        onUpdated={handleUpdated}
      />

      <ClienteHistorialModal
        clientId={historialId ?? 0}
        open={historialId !== null}
        onClose={() => setHistorialId(null)}
      />
    </>
  )
}
