'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, BarChart2, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { GastoModal } from '@/components/finanzas/GastoModal'
import styles from './finanzas.module.css'

interface Gasto {
  id:         number
  concepto:   string
  monto_usd:  number
  categoria:  string
  fecha:      string
  tipo:       'fijo' | 'variable'
  recurrente: boolean
  due_date:   string | null
}

type TipoFilter = 'todos' | 'fijo' | 'variable'

function getDueBadge(dueDate: string | null): { text: string; style: 'urgente' | 'vencido' } | null {
  if (!dueDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0)  return { text: 'Vencido',           style: 'vencido'  }
  if (diffDays === 0) return { text: 'Vence hoy',         style: 'vencido'  }
  if (diffDays <= 5)  return { text: `Vence en ${diffDays}d`, style: 'urgente' }
  return null
}

function monthEnd(month: string): string {
  const [y, m] = month.split('-')
  const last = new Date(Number(y), Number(m), 0).getDate()
  return `${month}-${String(last).padStart(2, '0')}`
}

export function GastosSection({ month }: { month: string }) {
  const [gastos,     setGastos]     = useState<Gasto[]>([])
  const [total,      setTotal]      = useState(0)
  const [showModal,  setShowModal]  = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('todos')
  const [from,       setFrom]       = useState(() => `${month}-01`)
  const [to,         setTo]         = useState(() => monthEnd(month))

  useEffect(() => {
    setFrom(`${month}-01`)
    setTo(monthEnd(month))
  }, [month])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ month, from, to })
      if (tipoFilter !== 'todos') params.set('tipo', tipoFilter)
      const res = await fetch(`/api/finanzas/gastos?${params}`)
      if (res.ok) {
        const j = await res.json()
        setGastos(j.gastos ?? [])
        setTotal(j.total_usd ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [month, from, to, tipoFilter])

  useEffect(() => { void load() }, [load])

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este gasto?')) return
    const res = await fetch(`/api/finanzas/gastos/${id}`, { method: 'DELETE' })
    if (res.ok) void load()
  }

  if (loading) return <div className={styles.loading}>Cargando gastos…</div>

  return (
    <>
      {/* ── Filters ── */}
      <div className={styles.gastosFilters}>
        <div className={styles.gastosDateRange}>
          <div className={styles.gastoDateField}>
            <label className={styles.gastosDateLabel}>Desde</label>
            <input
              type="date"
              className={styles.gastosDateInput}
              value={from}
              onChange={e => setFrom(e.target.value)}
              aria-label="Desde"
            />
          </div>
          <div className={styles.gastoDateField}>
            <label className={styles.gastosDateLabel}>Hasta</label>
            <input
              type="date"
              className={styles.gastosDateInput}
              value={to}
              onChange={e => setTo(e.target.value)}
              aria-label="Hasta"
            />
          </div>
        </div>
        <div className={styles.filterRow}>
          {(['todos', 'fijo', 'variable'] as TipoFilter[]).map(t => (
            <button
              key={t}
              type="button"
              className={`${styles.filterBtn} ${tipoFilter === t ? styles.filterBtnActive : ''}`}
              onClick={() => setTipoFilter(t)}
            >
              {t === 'todos' ? 'Todos' : t === 'fijo' ? 'Fijo' : 'Variable'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Header ── */}
      <div className={styles.sectionHeader}>
        <p className={styles.sectionSubtitle}>
          Total período: <strong>${total.toFixed(2)}</strong>
        </p>
        <button type="button" className={styles.newBtn} onClick={() => setShowModal(true)}>
          <Plus size={15} aria-hidden="true" />
          Nuevo gasto
        </button>
      </div>

      {/* ── Table ── */}
      {!gastos.length ? (
        <EmptyState
          icon={BarChart2}
          title="Sin gastos registrados"
          description="No hay gastos para este período."
        />
      ) : (
        <div className={styles.finTableWrap}>
          <table className={styles.finTable}>
            <thead>
              <tr>
                <th className={styles.finTh}>Fecha</th>
                <th className={styles.finTh}>Categoría</th>
                <th className={styles.finTh}>Descripción</th>
                <th className={`${styles.finTh} ${styles.colRight}`}>Monto USD</th>
                <th className={`${styles.finTh} ${styles.colCenter}`}>Tipo</th>
                <th className={`${styles.finTh} ${styles.colCenter}`}>Vence</th>
                <th className={styles.finTh} aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {gastos.map(g => {
                const badge = getDueBadge(g.due_date)
                return (
                  <tr key={g.id}>
                    <td className={styles.finTd}>
                      {new Date(g.fecha + 'T00:00:00').toLocaleDateString('es-VE')}
                    </td>
                    <td className={styles.finTd}>{g.categoria}</td>
                    <td className={`${styles.finTd} ${styles.tdPrimary}`}>{g.concepto}</td>
                    <td className={`${styles.finTd} ${styles.finAmtBold} ${styles.colRight}`}>
                      ${Number(g.monto_usd).toFixed(2)}
                    </td>
                    <td className={`${styles.finTd} ${styles.colCenter}`}>
                      <span className={g.tipo === 'fijo' ? styles.badgeFijo : styles.badgeVariable}>
                        {g.tipo === 'fijo' ? 'Fijo' : 'Variable'}
                      </span>
                    </td>
                    <td className={`${styles.finTd} ${styles.colCenter}`}>
                      {badge ? (
                        <span className={badge.style === 'vencido' ? styles.badgeVencido : styles.badgeUrgente}>
                          {badge.text}
                        </span>
                      ) : g.due_date ? (
                        <span className={styles.finSubText}>
                          {new Date(g.due_date + 'T00:00:00').toLocaleDateString('es-VE')}
                        </span>
                      ) : (
                        <span className={styles.finSubText}>—</span>
                      )}
                    </td>
                    <td className={styles.finTd}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => handleDelete(g.id)}
                        aria-label="Eliminar gasto"
                        title="Eliminar"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <GastoModal
        open={showModal}
        onClose={() => setShowModal(false)}
        mode="gasto"
        month={month}
        onSuccess={load}
      />
    </>
  )
}
