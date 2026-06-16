'use client'

import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { ShoppingCart, CreditCard, AlertTriangle, DollarSign, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui'
import styles from './DashboardOperativo.module.css'

interface CxCItem {
  sale_id:      number
  ticket_number: string
  client_name:  string
  saldo_usd:    number
  days_pending: number
  vencido:      boolean
}

interface Ops { sales_hoy: number; sales_count_hoy: number; creditos_abiertos: number }

interface CounterCardProps {
  icon:     ReactNode
  label:    string
  value:    string
  sub?:     string
  variant?: 'warning' | 'danger'
}

function CounterCard({ icon, label, value, sub, variant }: CounterCardProps) {
  const extra = variant === 'warning' ? styles.counterWarning
              : variant === 'danger'  ? styles.counterDanger
              : ''
  return (
    <div className={`${styles.counterCard} ${extra}`}>
      <div className={styles.counterIcon}>{icon}</div>
      <p className={styles.counterLabel}>{label}</p>
      <p className={styles.counterValue}>{value}</p>
      {sub && <p className={styles.counterSub}>{sub}</p>}
    </div>
  )
}

export default function DashboardOperativo() {
  const [ops, setOps]         = useState<Ops | null>(null)
  const [cxc, setCxc]         = useState<CxCItem[]>([])
  const [lowStock, setLowStock] = useState(0)
  const [rate, setRate]       = useState(0)

  useEffect(() => {
    fetch('/api/dashboard/charts?period=7d')
      .then(r => r.json())
      .then(j => {
        setOps(j.ops ?? null)
        setCxc(j.cxc_pendientes ?? [])
        setLowStock(j.low_stock_count ?? 0)
        setRate(j.bcvRate ?? 0)
      })
  }, [])

  const hasVencidos = cxc.some(c => c.vencido)

  return (
    <div className={styles.container}>
      <div className={styles.countersGrid}>
        <CounterCard
          icon={<ShoppingCart size={20} aria-hidden="true" />}
          label="Ventas del día"
          value={`$${(ops?.sales_hoy ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`${ops?.sales_count_hoy ?? 0} transacciones`}
        />
        <CounterCard
          icon={<CreditCard size={20} aria-hidden="true" />}
          label="Créditos abiertos"
          value={String(ops?.creditos_abiertos ?? 0)}
          variant={(ops?.creditos_abiertos ?? 0) > 0 ? 'warning' : undefined}
        />
        <CounterCard
          icon={<AlertTriangle size={20} aria-hidden="true" />}
          label="Stock crítico"
          value={String(lowStock)}
          variant={lowStock > 0 ? 'danger' : undefined}
        />
        <CounterCard
          icon={<DollarSign size={20} aria-hidden="true" />}
          label="Tasa BCV"
          value={rate > 0 ? `Bs ${rate.toFixed(2)}` : '—'}
        />
      </div>

      {cxc.length > 0 && (
        <div className={styles.alertCard}>
          <div className={styles.alertHeader}>
            <div className={styles.alertTitleRow}>
              <AlertCircle size={16} aria-hidden="true" />
              <h4 className={styles.alertTitle}>Cuentas por Cobrar pendientes</h4>
            </div>
            <Badge variant={hasVencidos ? 'danger' : 'warning'}>
              {cxc.length} pendiente{cxc.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className={styles.alertList}>
            {cxc.slice(0, 6).map(item => (
              <div key={item.sale_id} className={styles.alertItem}>
                <div className={styles.alertLeft}>
                  <span className={styles.alertClientName}>{item.client_name}</span>
                  <span className={styles.alertMeta}>{item.ticket_number} · {item.days_pending}d</span>
                </div>
                <div className={styles.alertRight}>
                  <span className={styles.alertSaldo}>${item.saldo_usd.toFixed(2)}</span>
                  {item.vencido && <Badge variant="danger" size="sm">Vencido</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
