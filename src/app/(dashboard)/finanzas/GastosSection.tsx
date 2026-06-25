'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, BarChart2, Trash2, Pencil } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { GastoModal } from '@/components/finanzas/GastoModal'
import styles from './finanzas.module.css'

interface Gasto {
  id:          number
  concepto:    string
  monto_usd:   number
  monto_bs:    number
  categoria:   string
  category_id: number | null
  fecha:       string
  notas:       string | null
  is_paid:     boolean
  due_date:    string | null
  supplier:    string | null
}

function getDueBadge(dueDate: string | null): { text: string; style: 'urgente' | 'vencido' } | null {
  if (!dueDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0)   return { text: 'Vencido',              style: 'vencido'  }
  if (diffDays === 0) return { text: 'Vence hoy',            style: 'vencido'  }
  if (diffDays <= 5)  return { text: `Vence en ${diffDays}d`, style: 'urgente' }
  return null
}

export function GastosSection({ month }: { month: string }) {
  const [gastos,    setGastos]    = useState<Gasto[]>([])
  const [total,     setTotal]     = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [editGasto, setEditGasto] = useState<Gasto | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/gastos?month=${month}`)
      if (res.ok) {
        const j = await res.json() as { ok: boolean; gastos: Gasto[] }
        const list = j.gastos ?? []
        setGastos(list)
        setTotal(list.reduce((s, g) => s + g.monto_usd, 0))
      }
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { void load() }, [load])

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este gasto?')) return
    const res = await fetch(`/api/gastos/${id}`, { method: 'DELETE' })
    if (res.ok) void load()
  }

  const handleEdit = (g: Gasto) => {
    setEditGasto(g)
    setShowModal(true)
  }

  if (loading) return <div className={styles.loading}>Cargando gastos…</div>

  return (
    <>
      {/* ── Header ── */}
      <div className={styles.sectionHeader}>
        <p className={styles.sectionSubtitle}>
          Total período: <strong>${total.toFixed(2)}</strong>
        </p>
        <button
          type="button"
          className={styles.newBtn}
          onClick={() => { setEditGasto(null); setShowModal(true) }}
        >
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
                      {new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-VE')}
                    </td>
                    <td className={styles.finTd}>{g.categoria}</td>
                    <td className={`${styles.finTd} ${styles.tdPrimary}`}>{g.concepto}</td>
                    <td className={`${styles.finTd} ${styles.finAmtBold} ${styles.colRight}`}>
                      ${Number(g.monto_usd).toFixed(2)}
                    </td>
                    <td className={`${styles.finTd} ${styles.colCenter}`}>
                      {badge ? (
                        <span className={badge.style === 'vencido' ? styles.badgeVencido : styles.badgeUrgente}>
                          {badge.text}
                        </span>
                      ) : g.due_date ? (
                        <span className={styles.finSubText}>
                          {new Date(g.due_date).toLocaleDateString('es-VE')}
                        </span>
                      ) : (
                        <span className={styles.finSubText}>—</span>
                      )}
                    </td>
                    <td className={styles.finTd}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => handleEdit(g)}
                        aria-label="Editar gasto"
                        title="Editar"
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
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
        onClose={() => { setShowModal(false); setEditGasto(null) }}
        mode="gasto"
        month={month}
        editData={editGasto}
        onSuccess={load}
      />
    </>
  )
}
