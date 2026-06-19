'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, BarChart2 } from 'lucide-react'
import { Badge, EmptyState } from '@/components/ui'
import { GastoModal } from '@/components/finanzas/GastoModal'
import styles from './finanzas.module.css'

interface Gasto {
  id:        number
  concepto:  string
  monto_usd: number
  categoria: string
  fecha:     string
}

interface CategoryRow { name: string; amount: number; pct: number }

function buildCategories(gastos: Gasto[], total: number): CategoryRow[] {
  const map = new Map<string, number>()
  for (const g of gastos) {
    map.set(g.categoria, (map.get(g.categoria) ?? 0) + g.monto_usd)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name,
      amount,
      pct: total > 0 ? (amount / total) * 100 : 0,
    }))
}

export function GastosSection({ month }: { month: string }) {
  const [gastos,     setGastos]     = useState<Gasto[]>([])
  const [total,      setTotal]      = useState(0)
  const [showModal,  setShowModal]  = useState(false)
  const [loading,    setLoading]    = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finanzas/gastos?month=${month}`)
      if (res.ok) {
        const j = await res.json()
        setGastos(j.gastos ?? [])
        setTotal(j.total_usd ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { load() }, [load])

  if (loading) return <div className={styles.loading}>Cargando gastos…</div>

  const categories = buildCategories(gastos, total)

  return (
    <>
      {/* ── Category distribution ── */}
      {categories.length > 0 && (
        <div className={styles.catSection}>
          <h3 className={styles.catSectionTitle}>Distribución por categoría</h3>
          <div className={styles.catList}>
            {categories.map(cat => (
              <div key={cat.name} className={styles.catRow}>
                <span className={styles.catName}>{cat.name}</span>
                <div className={styles.catBarWrap}>
                  <div className={styles.catBarFill} style={{ width: `${cat.pct}%` }} />
                </div>
                <span className={styles.catPct}>{cat.pct.toFixed(0)}%</span>
                <span className={styles.catAmt}>${cat.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className={styles.sectionHeader}>
        <p className={styles.sectionSubtitle}>
          Gastos del mes · Total: <strong>${total.toFixed(2)}</strong>
        </p>
        <button className={styles.newBtn} onClick={() => setShowModal(true)}>
          <Plus size={15} aria-hidden="true" />
          Nuevo gasto
        </button>
      </div>

      {/* ── Expense list ── */}
      {!gastos.length ? (
        <EmptyState
          icon={BarChart2}
          title="Sin gastos registrados"
          description="No hay gastos para este mes."
        />
      ) : (
        <div className={styles.cxcList}>
          {gastos.map(g => (
            <div key={g.id} className={styles.cxcRow}>
              <div className={styles.cxcLeft}>
                <span className={styles.cxcName}>{g.concepto}</span>
                <div className={styles.cxcMeta}>
                  <Badge variant="neutral" size="sm">{g.categoria}</Badge>
                  <span>·</span>
                  <span>{new Date(g.fecha).toLocaleDateString('es-VE')}</span>
                </div>
              </div>
              <div className={styles.cxcRight}>
                <span className={styles.cxcSaldo}>${g.monto_usd.toFixed(2)}</span>
              </div>
            </div>
          ))}
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
