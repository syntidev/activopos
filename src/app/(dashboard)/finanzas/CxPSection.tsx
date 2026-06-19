'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, Plus, FileText } from 'lucide-react'
import { EmptyState, useToast } from '@/components/ui'
import { GastoModal } from '@/components/finanzas/GastoModal'
import styles from './finanzas.module.css'

interface CxPItem {
  id:        number
  concepto:  string
  monto_usd: number
  categoria: string
  fecha:     string
}

const fmtUsd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function isUrgente(fechaStr: string): boolean {
  const fecha     = new Date(fechaStr)
  const threshold = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  return fecha <= threshold
}

export function CxPSection({ month }: { month: string }) {
  const { toast } = useToast()
  const [items,      setItems]      = useState<CxPItem[]>([])
  const [total,      setTotal]      = useState(0)
  const [showModal,  setShowModal]  = useState(false)
  const [loading,    setLoading]    = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/finanzas/cxp')
      if (res.ok) {
        const j = await res.json()
        setItems(j.cxp ?? [])
        setTotal(j.total_usd ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const markPaid = async (id: number) => {
    const res = await fetch(`/api/finanzas/cxp/${id}`, { method: 'PATCH' })
    if (res.ok) {
      toast('Marcado como pagado', 'success')
      load()
    } else {
      toast('Error al actualizar', 'error')
    }
  }

  if (loading) return <div className={styles.loading}>Cargando cuentas por pagar…</div>

  return (
    <>
      {/* ── Header ── */}
      <div className={styles.sectionHeader}>
        <div className={styles.miniKpiRow}>
          <div className={`${styles.miniKpi} ${items.length > 0 ? styles.miniKpiDanger : ''}`}>
            <span className={styles.miniKpiLabel}>Por pagar</span>
            <span className={`${styles.miniKpiValue} ${items.length > 0 ? styles.miniKpiValueDanger : ''}`}>
              {fmtUsd(total)}
            </span>
          </div>
        </div>
        <button className={styles.newBtn} onClick={() => setShowModal(true)}>
          <Plus size={15} aria-hidden="true" />
          Nueva CxP
        </button>
      </div>

      {/* ── Table ── */}
      {!items.length ? (
        <EmptyState
          icon={FileText}
          title="Sin cuentas por pagar"
          description="No hay deudas pendientes."
        />
      ) : (
        <div className={styles.catSection}>
          <div className={styles.finTableWrap}>
            <table className={styles.finTable}>
              <thead>
                <tr>
                  <th className={styles.finTh}>Concepto</th>
                  <th className={styles.finTh}>Categoría</th>
                  <th className={`${styles.finTh} ${styles.colRight}`}>Monto</th>
                  <th className={styles.finTh}>Fecha</th>
                  <th className={`${styles.finTh} ${styles.colCenter}`}>Estado</th>
                  <th className={`${styles.finTh} ${styles.colRight}`}>Pagar</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const urgente = isUrgente(item.fecha)
                  return (
                    <tr key={item.id}>
                      <td className={styles.finTd}>
                        <span className={styles.finAmtBold}>{item.concepto}</span>
                      </td>
                      <td className={styles.finTd}>{item.categoria}</td>
                      <td className={`${styles.finTd} ${styles.colRight}`}>
                        <span className={styles.finAmtBold}>{fmtUsd(item.monto_usd)}</span>
                      </td>
                      <td className={styles.finTd}>
                        {new Date(item.fecha).toLocaleDateString('es-VE')}
                      </td>
                      <td className={`${styles.finTd} ${styles.colCenter}`}>
                        {urgente && <span className={styles.badgeUrgente}>Urgente</span>}
                      </td>
                      <td className={`${styles.finTd} ${styles.colRight}`}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => markPaid(item.id)}
                        >
                          <CheckCircle size={12} aria-hidden="true" />
                          Pagar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <GastoModal
        open={showModal}
        onClose={() => setShowModal(false)}
        mode="cxp"
        month={month}
        onSuccess={load}
      />
    </>
  )
}
