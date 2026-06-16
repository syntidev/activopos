'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, FileText } from 'lucide-react'
import { Badge, EmptyState } from '@/components/ui'
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

export function CxCSection({ rate }: { rate: number }) {
  const [items, setItems]       = useState<CxCItem[]>([])
  const [totals, setTotals]     = useState<CxCTotals>({ count: 0, saldo_usd: 0, vencido_usd: 0 })
  const [selected, setSelected] = useState<SaleForAbono | null>(null)
  const [loading, setLoading]   = useState(true)

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

  if (loading) return <div className={styles.loading}>Cargando cuentas por cobrar...</div>

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
      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Total por cobrar</span>
          <span className={styles.summaryValue}>${totals.saldo_usd.toFixed(2)}</span>
        </div>
        {totals.vencido_usd > 0 && (
          <div className={`${styles.summaryCard} ${styles.summaryDanger}`}>
            <span className={styles.summaryLabel}>Monto vencido</span>
            <span className={styles.summaryValue}>${totals.vencido_usd.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className={styles.cxcList}>
        {items.map(item => (
          <div key={item.sale_id} className={styles.cxcRow}>
            <div className={styles.cxcLeft}>
              <span className={styles.cxcName}>{item.client_name}</span>
              <div className={styles.cxcMeta}>
                <span>{item.ticket_number}</span>
                <span>·</span>
                <span>{item.days_pending}d pendiente</span>
                {item.vencido && <Badge variant="danger" size="sm">Vencido</Badge>}
              </div>
            </div>
            <div className={styles.cxcRight}>
              <span className={styles.cxcSaldo}>${item.saldo_usd.toFixed(2)}</span>
              <button
                className={styles.abonarBtn}
                onClick={() => setSelected({
                  id:            item.sale_id,
                  ticket_number: item.ticket_number,
                  client_name:   item.client_name,
                  total_usd:     item.total_usd,
                  abonado_usd:   item.abonado_usd,
                })}
              >
                <Plus size={13} aria-hidden="true" />
                Abonar
              </button>
            </div>
          </div>
        ))}
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
