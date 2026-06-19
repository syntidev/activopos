'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, FileText } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { AbonoModal } from '@/components/finanzas/AbonoModal'
import type { SaleForAbono } from '@/components/finanzas/AbonoModal'
import styles from './finanzas.module.css'

interface CxCItem {
  sale_id:       number
  ticket_number: string
  client_name:   string
  total_usd:     number
  abonado_usd:   number
  saldo_usd:     number
  days_pending:  number
  vencido:       boolean
}

interface CxCTotals { count: number; saldo_usd: number; vencido_usd: number }

const fmtUsd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function CxCSection({ rate }: { rate: number }) {
  const [items,    setItems]    = useState<CxCItem[]>([])
  const [totals,   setTotals]   = useState<CxCTotals>({ count: 0, saldo_usd: 0, vencido_usd: 0 })
  const [selected, setSelected] = useState<SaleForAbono | null>(null)
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/finanzas/cxc')
      if (res.ok) {
        const j = await res.json()
        setItems(j.cxc ?? [])
        setTotals(j.totals ?? { count: 0, saldo_usd: 0, vencido_usd: 0 })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className={styles.loading}>Cargando cuentas por cobrar…</div>

  if (!items.length) {
    return (
      <EmptyState
        icon={FileText}
        title="Sin cuentas por cobrar"
        description="No hay ventas pendientes de cobro."
      />
    )
  }

  return (
    <>
      {/* ── Mini KPIs ── */}
      <div className={styles.miniKpiRow}>
        <div className={styles.miniKpi}>
          <span className={styles.miniKpiLabel}>Por cobrar</span>
          <span className={styles.miniKpiValue}>{fmtUsd(totals.saldo_usd)}</span>
        </div>
        <div className={styles.miniKpi}>
          <span className={styles.miniKpiLabel}>Facturas</span>
          <span className={styles.miniKpiValue}>{totals.count}</span>
        </div>
        {totals.vencido_usd > 0 && (
          <div className={`${styles.miniKpi} ${styles.miniKpiDanger}`}>
            <span className={styles.miniKpiLabel}>Vencido</span>
            <span className={`${styles.miniKpiValue} ${styles.miniKpiValueDanger}`}>
              {fmtUsd(totals.vencido_usd)}
            </span>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className={styles.catSection}>
        <div className={styles.finTableWrap}>
          <table className={styles.finTable}>
            <thead>
              <tr>
                <th className={styles.finTh}>Cliente</th>
                <th className={styles.finTh}>Ticket</th>
                <th className={`${styles.finTh} ${styles.colRight}`}>Saldo</th>
                <th className={`${styles.finTh} ${styles.colCenter}`}>Estado</th>
                <th className={`${styles.finTh} ${styles.colRight}`}>Abonar</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.sale_id}>
                  <td className={styles.finTd}>
                    <span className={styles.finAmtBold}>{item.client_name}</span>
                    <span className={styles.finSubText}>{item.days_pending}d pendiente</span>
                  </td>
                  <td className={styles.finTd}>{item.ticket_number}</td>
                  <td className={`${styles.finTd} ${styles.colRight}`}>
                    <span className={styles.finAmtBold}>{fmtUsd(item.saldo_usd)}</span>
                    {rate > 0 && (
                      <span className={styles.finSubText}>
                        Bs. {(item.saldo_usd * rate).toLocaleString('es-VE', { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </td>
                  <td className={`${styles.finTd} ${styles.colCenter}`}>
                    {item.vencido && <span className={styles.badgeVencido}>Vencido</span>}
                  </td>
                  <td className={`${styles.finTd} ${styles.colRight}`}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => setSelected({
                        id:            item.sale_id,
                        ticket_number: item.ticket_number,
                        client_name:   item.client_name,
                        total_usd:     item.total_usd,
                        abonado_usd:   item.abonado_usd,
                      })}
                    >
                      <Plus size={12} aria-hidden="true" />
                      Abonar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AbonoModal
        open={!!selected}
        onClose={() => setSelected(null)}
        sale={selected}
        rate={rate}
        onSuccess={load}
      />
    </>
  )
}
