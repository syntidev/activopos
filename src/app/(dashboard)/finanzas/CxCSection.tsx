'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, FileText } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { AbonoModal } from '@/components/finanzas/AbonoModal'
import type { SaleForAbono } from '@/components/finanzas/AbonoModal'
import styles from './finanzas.module.css'

type Bucket = 'vigente' | 'por_vencer' | 'vencido'
type FilterKey = 'todo' | Bucket

interface CxCItem {
  sale_id:       number
  ticket_number: string
  client_name:   string
  client_id:     number | null
  total_usd:     number
  abonado_usd:   number
  saldo_usd:     number
  dias_vencido:  number
  due_date:      string
  bucket:        Bucket
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'todo',       label: 'Todas'      },
  { key: 'vencido',    label: 'Vencidas'   },
  { key: 'por_vencer', label: 'Por vencer' },
  { key: 'vigente',    label: 'Vigentes'   },
]

const fmtUsd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function fmtDue(item: CxCItem): string {
  if (item.bucket === 'vencido') return `Hace ${item.dias_vencido}d`
  const days = Math.round((new Date(item.due_date).getTime() - Date.now()) / 86_400_000)
  if (days === 0) return 'Hoy'
  return `${days}d`
}

export function CxCSection({ rate }: { rate: number }) {
  const [items,    setItems]    = useState<CxCItem[]>([])
  const [totals,   setTotals]   = useState({ vencido: 0, por_vencer: 0, vigente: 0 })
  const [selected, setSelected] = useState<SaleForAbono | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<FilterKey>('todo')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/finanzas/cxc?limit=100')
      if (res.ok) {
        const j = await res.json()
        setItems(j.items ?? [])
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

  useEffect(() => { load() }, [load])

  /* ── Derived groups ── */
  const grouped = {
    vencido:    items.filter(i => i.bucket === 'vencido'),
    por_vencer: items.filter(i => i.bucket === 'por_vencer'),
    vigente:    items.filter(i => i.bucket === 'vigente'),
  }

  const filtered = filter === 'todo' ? items : grouped[filter]

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
      {/* ── Summary cards ── */}
      <div className={styles.miniKpiRow}>
        <div className={`${styles.miniKpi} ${grouped.vencido.length ? styles.miniKpiDanger : ''}`}>
          <span className={styles.miniKpiLabel}>Vencido</span>
          <span className={`${styles.miniKpiValue} ${grouped.vencido.length ? styles.miniKpiValueDanger : ''}`}>
            {fmtUsd(totals.vencido)}
          </span>
          <span className={styles.miniKpiCount}>{grouped.vencido.length} factura{grouped.vencido.length !== 1 ? 's' : ''}</span>
        </div>
        <div className={`${styles.miniKpi} ${grouped.por_vencer.length ? styles.miniKpiWarning : ''}`}>
          <span className={styles.miniKpiLabel}>Por vencer</span>
          <span className={`${styles.miniKpiValue} ${grouped.por_vencer.length ? styles.miniKpiValueWarning : ''}`}>
            {fmtUsd(totals.por_vencer)}
          </span>
          <span className={styles.miniKpiCount}>{grouped.por_vencer.length} factura{grouped.por_vencer.length !== 1 ? 's' : ''}</span>
        </div>
        <div className={`${styles.miniKpi} ${grouped.vigente.length ? styles.miniKpiSuccess : ''}`}>
          <span className={styles.miniKpiLabel}>Vigente</span>
          <span className={`${styles.miniKpiValue} ${grouped.vigente.length ? styles.miniKpiValueSuccess : ''}`}>
            {fmtUsd(totals.vigente)}
          </span>
          <span className={styles.miniKpiCount}>{grouped.vigente.length} factura{grouped.vigente.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* ── Filter row ── */}
      <div className={styles.filterRow} role="group" aria-label="Filtrar cuentas por cobrar">
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
      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Sin resultados en este filtro" />
      ) : (
        <div className={styles.catSection}>
          <div className={styles.finTableWrap}>
            <table className={styles.finTable}>
              <thead>
                <tr>
                  <th className={styles.finTh}>Cliente</th>
                  <th className={styles.finTh}>Ticket</th>
                  <th className={`${styles.finTh} ${styles.colRight}`}>Saldo</th>
                  <th className={`${styles.finTh} ${styles.colCenter}`}>Vence</th>
                  <th className={`${styles.finTh} ${styles.colCenter}`}>Estado</th>
                  <th className={`${styles.finTh} ${styles.colRight}`}>Abonar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.sale_id}>
                    <td className={styles.finTd}>
                      <span className={styles.finAmtBold}>{item.client_name}</span>
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
                      <span className={styles.finSubText}>{fmtDue(item)}</span>
                    </td>
                    <td className={`${styles.finTd} ${styles.colCenter}`}>
                      {item.bucket === 'vencido'    && <span className={styles.badgeVencido}>Vencido</span>}
                      {item.bucket === 'por_vencer' && <span className={styles.badgeUrgente}>Próximo</span>}
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
      )}

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
