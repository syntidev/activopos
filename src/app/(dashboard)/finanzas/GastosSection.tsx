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

interface ER {
  ventas_netas:      number
  costo_ventas:      number
  utilidad_bruta:    number
  margen_bruto_pct:  number
  gastos_operativos: number
  utilidad_neta:     number
  margen_neto_pct:   number
}

function ErLine({
  label, value, pct, isSubtotal, isPositive, isNegative,
}: {
  label: string; value: number; pct?: number
  isSubtotal?: boolean; isPositive?: boolean; isNegative?: boolean
}) {
  const cls = isPositive ? styles.erPositivo
            : isNegative ? styles.erNegativo
            : isSubtotal ? styles.erSubtotal
            : styles.erLinea
  return (
    <div className={cls}>
      <span>{label}</span>
      <span>
        {value < 0 ? '-' : ''}${Math.abs(value).toFixed(2)}
        {pct !== undefined && <span className={styles.erPct}> ({pct.toFixed(1)}%)</span>}
      </span>
    </div>
  )
}

export function GastosSection({ month }: { month: string }) {
  const [gastos, setGastos]       = useState<Gasto[]>([])
  const [er, setEr]               = useState<ER | null>(null)
  const [insight, setInsight]     = useState('')
  const [total, setTotal]         = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [gRes, rRes] = await Promise.all([
        fetch(`/api/finanzas/gastos?month=${month}`),
        fetch(`/api/finanzas/resumen?month=${month}`),
      ])
      if (gRes.ok) { const j = await gRes.json(); setGastos(j.gastos ?? []); setTotal(j.total_usd ?? 0) }
      if (rRes.ok) { const j = await rRes.json(); setEr(j.estado_resultados ?? null); setInsight(j.insight ?? '') }
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { load() }, [load])

  if (loading) return <div className={styles.loading}>Cargando ingresos y gastos...</div>

  const netaPositive = er && er.utilidad_neta >= 0
  const netaNegative = er && er.utilidad_neta < 0

  return (
    <>
      {er && (
        <div className={styles.erCard}>
          <h4 className={styles.erTitle}>Estado de Resultados</h4>
          {insight && <p className={styles.erInsight}>{insight}</p>}
          <div className={styles.erBody}>
            <ErLine label="Ventas netas"            value={er.ventas_netas} />
            <ErLine label="(-) Costo de ventas"     value={-er.costo_ventas} />
            <ErLine label="Utilidad bruta"           value={er.utilidad_bruta}   pct={er.margen_bruto_pct} isSubtotal />
            <ErLine label="(-) Gastos operativos"   value={-er.gastos_operativos} />
            <ErLine
              label="Utilidad neta"
              value={er.utilidad_neta}
              pct={er.margen_neto_pct}
              isPositive={!!netaPositive}
              isNegative={!!netaNegative}
            />
          </div>
        </div>
      )}

      <div className={styles.sectionHeader}>
        <p className={styles.sectionSubtitle}>
          Gastos del mes · Total: <strong>${total.toFixed(2)}</strong>
        </p>
        <button className={styles.newBtn} onClick={() => setShowModal(true)}>
          <Plus size={15} aria-hidden="true" />
          Nuevo gasto
        </button>
      </div>

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
