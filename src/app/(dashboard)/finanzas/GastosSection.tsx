'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Receipt, Tag, Pencil, Trash2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui'
import { GastoModal } from '@/components/finanzas/GastoModal'
import { CategoriasGastos } from './CategoriasGastos'
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

interface ExpenseCat {
  id:        number
  name:      string
  color:     string | null
  is_system: boolean
}

const FALLBACK_COLORS: Record<string, string> = {
  alquiler:      '#6366F1',
  servicios:     '#0EA5E9',
  nomina:        '#10B981',
  materiales:    '#F59E0B',
  transporte:    '#3B82F6',
  impuestos:     '#EF4444',
  mantenimiento: '#F97316',
  marketing:     '#8B5CF6',
  otro:          '#94A3B8',
  proveedor:     '#64748B',
}

function getDueBadge(dueDate: string | null): { text: string; style: 'urgente' | 'vencido' } | null {
  if (!dueDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T12:00:00')
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0)   return { text: 'Vencido',               style: 'vencido' }
  if (diffDays === 0) return { text: 'Vence hoy',             style: 'vencido' }
  if (diffDays <= 5)  return { text: `Vence en ${diffDays}d`, style: 'urgente' }
  return null
}

export function GastosSection({ month, rate }: { month: string; rate: number }) {
  const [gastos,         setGastos]         = useState<Gasto[]>([])
  const [catMap,         setCatMap]         = useState<Map<number, ExpenseCat>>(new Map())
  const [showModal,      setShowModal]      = useState(false)
  const [showManageCats, setShowManageCats] = useState(false)
  const [loading,        setLoading]        = useState(true)
  const [editGasto,      setEditGasto]      = useState<Gasto | null>(null)
  const [search,         setSearch]         = useState('')

  const loadCats = useCallback(async () => {
    try {
      const res = await fetch('/api/finanzas/categorias')
      const j   = await res.json() as { ok: boolean; categories: ExpenseCat[] }
      if (j.ok) setCatMap(new Map(j.categories.map(c => [c.id, c])))
    } catch { /* silent */ }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/gastos?month=${month}`)
      if (res.ok) {
        const j = await res.json() as { ok: boolean; gastos: Gasto[] }
        setGastos(j.gastos ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    void loadCats()
  }, [loadCats])

  useEffect(() => {
    void load()
  }, [load])

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este gasto?')) return
    const res = await fetch(`/api/gastos/${id}`, { method: 'DELETE' })
    if (res.ok) void load()
  }

  const handleEdit = (g: Gasto) => {
    setEditGasto(g)
    setShowModal(true)
  }

  const filteredGastos = search
    ? gastos.filter(g =>
        g.concepto.toLowerCase().includes(search.toLowerCase()) ||
        (catMap.get(g.category_id ?? -1)?.name ?? g.categoria).toLowerCase().includes(search.toLowerCase())
      )
    : gastos

  const totalPeriodo = gastos.reduce((s, g) => s + Number(g.monto_usd), 0)
  const totalFijo    = gastos.filter(g => g.due_date !== null).reduce((s, g) => s + Number(g.monto_usd), 0)
  const totalVar     = gastos.filter(g => g.due_date === null).reduce((s, g) => s + Number(g.monto_usd), 0)

  if (loading) return <div className={styles.loading}>Cargando gastos…</div>

  return (
    <>
      {/* ── KPI strip ── */}
      <div className={styles.gastoKpiStrip}>
        <div className={styles.gastoKpiCell}>
          <span className={styles.gastoKpiLabel}>Total período</span>
          <span className={styles.gastoKpiValue}>${totalPeriodo.toFixed(2)}</span>
          {rate > 0 && (
            <span className={styles.kpiBs}>
              Bs. {(totalPeriodo * rate).toLocaleString('es-VE', { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>
        <div className={styles.gastoKpiCell}>
          <span className={styles.gastoKpiLabel}>Fijo</span>
          <span className={`${styles.gastoKpiValue} ${styles.gastoKpiValueFijo}`}>
            ${totalFijo.toFixed(2)}
          </span>
          {rate > 0 && (
            <span className={styles.kpiBs}>
              Bs. {(totalFijo * rate).toLocaleString('es-VE', { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>
        <div className={styles.gastoKpiCell}>
          <span className={styles.gastoKpiLabel}>Variable</span>
          <span className={`${styles.gastoKpiValue} ${styles.gastoKpiValueVar}`}>
            ${totalVar.toFixed(2)}
          </span>
          {rate > 0 && (
            <span className={styles.kpiBs}>
              Bs. {(totalVar * rate).toLocaleString('es-VE', { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>
      </div>

      {/* ── Header ── */}
      <div className={styles.sectionHeader}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            placeholder="Descripción o categoría…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.searchInput}
            aria-label="Buscar gastos"
          />
          {search && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setSearch('')}
              aria-label="Limpiar búsqueda"
            >
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className={styles.headerBtns}>
          <Button
            type="button"
            variant="secondary"
            leftIcon={<Tag size={14} />}
            onClick={() => setShowManageCats(true)}
          >
            Gestionar categorías
          </Button>
          <Button
            type="button"
            variant="primary"
            leftIcon={<Plus size={15} />}
            onClick={() => { setEditGasto(null); setShowModal(true) }}
          >
            Nuevo gasto
          </Button>
        </div>
      </div>

      {/* ── Table or empty state ── */}
      {!gastos.length ? (
        <EmptyState
          icon={Receipt}
          title="Sin gastos en este período"
          action={
            <Button
              type="button"
              variant="primary"
              leftIcon={<Plus size={15} />}
              onClick={() => { setEditGasto(null); setShowModal(true) }}
            >
              Nuevo gasto
            </Button>
          }
        />
      ) : !filteredGastos.length ? (
        <EmptyState icon={Receipt} title="Sin resultados para la búsqueda" />
      ) : (
        <div className={styles.finTableWrap}>
          <table className={styles.finTable}>
            <thead>
              <tr>
                <th className={styles.finTh}>Fecha</th>
                <th className={`${styles.finTh} ${styles.thHidden}`}>Categoría</th>
                <th className={styles.finTh}>Descripción</th>
                <th className={`${styles.finTh} ${styles.thHidden}`}>Tipo</th>
                <th className={`${styles.finTh} ${styles.colRight}`}>Monto USD</th>
                <th className={`${styles.finTh} ${styles.colCenter} ${styles.thHidden}`}>Vence</th>
                <th className={styles.finTh} aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {filteredGastos.map(g => {
                const cat      = g.category_id ? catMap.get(g.category_id) : null
                const catColor = cat?.color ?? FALLBACK_COLORS[g.categoria] ?? '#94A3B8'
                const catLabel = cat?.name  ?? g.categoria
                const isFijo   = g.due_date !== null
                const badge    = getDueBadge(g.due_date)

                return (
                  <tr key={g.id}>
                    <td className={styles.finTd} data-label="Fecha">
                      {new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-VE')}
                    </td>

                    <td className={`${styles.finTd} ${styles.tdHidden}`} data-label="Categoría">
                      <span className={styles.catBadge}>
                        <span
                          className={styles.catDot}
                          style={{ background: catColor }}
                          aria-hidden="true"
                        />
                        <span className={styles.catName}>{catLabel}</span>
                      </span>
                    </td>

                    <td className={`${styles.finTd} ${styles.tdPrimary}`} data-label="Descripción">{g.concepto}</td>

                    <td className={`${styles.finTd} ${styles.tdHidden}`} data-label="Tipo">
                      {isFijo
                        ? <span className={styles.badgeFijo}>Fijo</span>
                        : <span className={styles.badgeVariable}>Variable</span>
                      }
                    </td>

                    <td className={`${styles.finTd} ${styles.finAmtBold} ${styles.colRight}`} data-label="Monto USD">
                      ${Number(g.monto_usd).toFixed(2)}
                    </td>

                    <td className={`${styles.finTd} ${styles.colCenter} ${styles.tdHidden}`} data-label="Vence">
                      {badge ? (
                        <span className={badge.style === 'vencido' ? styles.badgeVencido : styles.badgeUrgente}>
                          {badge.text}
                        </span>
                      ) : g.due_date ? (
                        <span className={styles.finSubText}>
                          {new Date(g.due_date + 'T12:00:00').toLocaleDateString('es-VE')}
                        </span>
                      ) : null}
                    </td>

                    <td className={styles.finTd} data-label="Acciones">
                      <span className={styles.actionsBtnGroup}>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleEdit(g)}
                          aria-label="Editar gasto"
                          title="Editar"
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="btn-icon danger"
                          onClick={() => handleDelete(g.id)}
                          aria-label="Eliminar gasto"
                          title="Eliminar"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </span>
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

      <CategoriasGastos
        open={showManageCats}
        onClose={() => setShowManageCats(false)}
      />
    </>
  )
}
