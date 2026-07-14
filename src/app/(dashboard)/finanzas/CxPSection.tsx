'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, Plus, FileText, Pencil, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState, useToast } from '@/components/ui'
import { GastoModal } from '@/components/finanzas/GastoModal'
import styles from './finanzas.module.css'

type Bucket = 'vigente' | 'por_vencer' | 'vencido'
type FilterKey = 'todo' | Bucket

interface CxPItem {
  id:           number
  concepto:     string
  monto_usd:    number
  categoria:    string
  category_id:  number | null
  fecha:        string
  notas:        string | null
  due_date:     string | null
  supplier:     { id: number; name: string } | null
  bucket:       Bucket
  dias_vencido: number
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'todo',       label: 'Todas'      },
  { key: 'vencido',    label: 'Vencidas'   },
  { key: 'por_vencer', label: 'Por vencer' },
  { key: 'vigente',    label: 'Vigentes'   },
]

const fmtUsd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function fmtDue(item: CxPItem): string {
  if (item.bucket === 'vencido') return `Hace ${item.dias_vencido}d`
  const days = Math.round((new Date(item.due_date ?? item.fecha).getTime() - Date.now()) / 86_400_000)
  if (days === 0) return 'Hoy'
  return `${days}d`
}

export function CxPSection({ month }: { month: string }) {
  const { toast } = useToast()
  const [items,         setItems]         = useState<CxPItem[]>([])
  const [totals,        setTotals]        = useState({ vencido: 0, por_vencer: 0, vigente: 0 })
  const [showModal,     setShowModal]     = useState(false)
  const [editCxP,       setEditCxP]       = useState<CxPItem | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [filter,        setFilter]        = useState<FilterKey>('todo')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/finanzas/cxp')
      if (res.ok) {
        const j = await res.json()
        setItems(j.cxp ?? [])
        setTotals({
          vencido:    j.vencido_usd    ?? 0,
          por_vencer: j.por_vencer_usd ?? 0,
          vigente:    j.vigente_usd    ?? 0,
        })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const markPaid = async (id: number) => {
    const res = await fetch(`/api/finanzas/cxp/${id}`, { method: 'PATCH' })
    if (res.ok) {
      toast('Marcado como pagado', 'success')
      void load()
    } else {
      toast('Error al actualizar', 'error')
    }
  }

  const handleEditCxP = (item: CxPItem) => {
    setEditCxP(item)
    setShowEditModal(true)
  }

  const searched = search
    ? items.filter(i =>
        i.concepto.toLowerCase().includes(search.toLowerCase()) ||
        i.categoria.toLowerCase().includes(search.toLowerCase()) ||
        (i.supplier?.name.toLowerCase().includes(search.toLowerCase()) ?? false)
      )
    : items

  const grouped = {
    vencido:    searched.filter(i => i.bucket === 'vencido'),
    por_vencer: searched.filter(i => i.bucket === 'por_vencer'),
    vigente:    searched.filter(i => i.bucket === 'vigente'),
  }

  const filtered = filter === 'todo' ? searched : grouped[filter]

  if (loading) return <div className={styles.loading}>Cargando cuentas por pagar…</div>

  return (
    <>
      {/* ── Header ── */}
      <div className={styles.sectionHeader}>
        <div className={styles.miniKpiRow}>
          <div className={`${styles.miniKpi} ${grouped.vencido.length ? styles.miniKpiDanger : ''}`}>
            <span className={styles.miniKpiLabel}>Vencido</span>
            <span className={`${styles.miniKpiValue} ${grouped.vencido.length ? styles.miniKpiValueDanger : ''}`}>
              {fmtUsd(totals.vencido)}
            </span>
            <span className={styles.miniKpiCount}>{grouped.vencido.length} cuenta{grouped.vencido.length !== 1 ? 's' : ''}</span>
          </div>
          <div className={`${styles.miniKpi} ${grouped.por_vencer.length ? styles.miniKpiWarning : ''}`}>
            <span className={styles.miniKpiLabel}>Por vencer</span>
            <span className={`${styles.miniKpiValue} ${grouped.por_vencer.length ? styles.miniKpiValueWarning : ''}`}>
              {fmtUsd(totals.por_vencer)}
            </span>
            <span className={styles.miniKpiCount}>{grouped.por_vencer.length} cuenta{grouped.por_vencer.length !== 1 ? 's' : ''}</span>
          </div>
          <div className={`${styles.miniKpi} ${grouped.vigente.length ? styles.miniKpiSuccess : ''}`}>
            <span className={styles.miniKpiLabel}>Vigente</span>
            <span className={`${styles.miniKpiValue} ${grouped.vigente.length ? styles.miniKpiValueSuccess : ''}`}>
              {fmtUsd(totals.vigente)}
            </span>
            <span className={styles.miniKpiCount}>{grouped.vigente.length} cuenta{grouped.vigente.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <Button type="button" variant="primary" leftIcon={<Plus size={15} />} onClick={() => setShowModal(true)}>
          Nueva CxP
        </Button>
      </div>

      {/* ── Search ── */}
      <div className={styles.searchWrap}>
        <Search size={15} className={styles.searchIcon} aria-hidden="true" />
        <input
          type="search"
          placeholder="Proveedor o descripción…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={styles.searchInput}
          aria-label="Buscar cuentas por pagar"
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

      {/* ── Filter row ── */}
      <div className={styles.filterRow} role="group" aria-label="Filtrar cuentas por pagar">
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            className={`${styles.filterBtn} ${filter === f.key ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      {!items.length ? (
        <EmptyState
          icon={FileText}
          title="Sin cuentas por pagar"
          description="No hay deudas pendientes."
        />
      ) : !filtered.length ? (
        <EmptyState icon={FileText} title="Sin resultados en este filtro" />
      ) : (
        <div className={styles.catSection}>
          <div className={styles.finTableWrap}>
            <table className={styles.finTable}>
              <thead>
                <tr>
                  <th className={styles.finTh}>Proveedor / Concepto</th>
                  <th className={`${styles.finTh} ${styles.thHidden}`}>Categoría</th>
                  <th className={`${styles.finTh} ${styles.colRight}`}>Monto</th>
                  <th className={`${styles.finTh} ${styles.colCenter}`}>Vence</th>
                  <th className={`${styles.finTh} ${styles.colCenter} ${styles.thHidden}`}>Estado</th>
                  <th className={`${styles.finTh} ${styles.colRight}`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  return (
                    <tr key={item.id}>
                      <td className={styles.finTd} data-label="Proveedor / Concepto">
                        <span className={styles.finAmtBold}>{item.supplier?.name ?? item.concepto}</span>
                        {item.supplier && <span className={styles.finSubText}>{item.concepto}</span>}
                      </td>
                      <td className={`${styles.finTd} ${styles.tdHidden}`} data-label="Categoría">{item.categoria}</td>
                      <td className={`${styles.finTd} ${styles.colRight}`} data-label="Monto">
                        <span className={styles.finAmtBold}>{fmtUsd(item.monto_usd)}</span>
                      </td>
                      <td className={`${styles.finTd} ${styles.colCenter}`} data-label="Vence">
                        <span className={styles.finSubText}>{fmtDue(item)}</span>
                      </td>
                      <td className={`${styles.finTd} ${styles.colCenter} ${styles.tdHidden}`} data-label="Estado">
                        {item.bucket === 'vencido'    && <span className={styles.badgeVencido}>Vencido</span>}
                        {item.bucket === 'por_vencer' && <span className={styles.badgeUrgente}>Próximo</span>}
                      </td>
                      <td className={`${styles.finTd} ${styles.colRight}`} data-label="Acciones">
                        <span className={styles.actionsBtnGroup}>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => handleEditCxP(item)}
                            aria-label="Editar cuenta por pagar"
                            title="Editar"
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                          <Button
                            type="button"
                            variant="primary"
                            leftIcon={<CheckCircle size={12} />}
                            onClick={() => void markPaid(item.id)}
                          >
                            Pagar
                          </Button>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal — crear nueva CxP */}
      <GastoModal
        open={showModal}
        onClose={() => setShowModal(false)}
        mode="cxp"
        month={month}
        onSuccess={load}
      />

      {/* Modal — editar CxP existente (gasto mode → PATCH /api/gastos/:id) */}
      <GastoModal
        open={showEditModal}
        onClose={() => { setShowEditModal(false); setEditCxP(null) }}
        mode="gasto"
        month={month}
        editData={editCxP}
        onSuccess={load}
      />
    </>
  )
}
