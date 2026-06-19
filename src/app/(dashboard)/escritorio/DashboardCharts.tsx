'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer, LineChart, Line,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { DollarSign, TrendingUp, ShoppingBag, BarChart2 } from 'lucide-react'
import styles from './DashboardCharts.module.css'

type Period = '7d' | '30d' | '12m'
interface DailyPoint { date: string; usd: number; tx_count: number }
interface BarPoint   { date: string; usd: number }
interface PiePoint   { name: string; value: number; color: string }
interface TopProduct { name: string; qty: number; total_usd: number }

interface ChartsPayload {
  ventas_linea:    DailyPoint[]
  utilidad_barras: BarPoint[]
  metodos_pie:     PiePoint[]
  top_products:    TopProduct[]
}

const PERIODS: { key: Period; label: string }[] = [
  { key: '7d',  label: '7 días'   },
  { key: '30d', label: '30 días'  },
  { key: '12m', label: '12 meses' },
]

const TT_STYLE = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  fontSize: '12px',
  color: 'var(--color-text-primary)',
}

export default function DashboardCharts() {
  const [period, setPeriod] = useState<Period>('7d')
  const [data, setData]     = useState<ChartsPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/charts?period=${p}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(period) }, [fetchData, period])

  const totalSales  = data?.ventas_linea.reduce((s, d) => s + d.usd, 0) ?? 0
  const totalTx     = data?.ventas_linea.reduce((s, d) => s + d.tx_count, 0) ?? 0
  const totalProfit = data?.utilidad_barras.reduce((s, d) => s + d.usd, 0) ?? 0
  const avgTicket   = totalTx > 0 ? totalSales / totalTx : 0

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.sectionTitle}>Rendimiento</h3>
        <div className={styles.periodSelector}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              className={`${styles.periodBtn} ${period === p.key ? styles.periodBtnActive : ''}`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.metricsGrid}>
        {[
          { icon: DollarSign,  label: 'Ventas del período',  value: `$${totalSales.toFixed(2)}`  },
          { icon: TrendingUp,  label: 'Utilidad bruta',      value: `$${totalProfit.toFixed(2)}` },
          { icon: ShoppingBag, label: 'Transacciones',       value: String(totalTx)               },
          { icon: BarChart2,   label: 'Ticket promedio',     value: `$${avgTicket.toFixed(2)}`   },
        ].map(m => {
          const Icon = m.icon
          return (
            <div key={m.label} className={styles.metricCard}>
              <Icon size={15} className={styles.metricIcon} aria-hidden="true" />
              <p className={styles.metricLabel}>{m.label}</p>
              <p className={styles.metricValue}>{m.value}</p>
            </div>
          )
        })}
      </div>

      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>Ventas USD</p>
          {loading ? <div className={styles.chartSkeleton} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data?.ventas_linea ?? []} margin={{ top: 5, right: 8, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => `$${v}`} />
                <Tooltip contentStyle={TT_STYLE} formatter={(v) => [`$${(v as number).toFixed(2)}`, 'Ventas']} />
                <Line type="monotone" dataKey="usd" stroke="#0D9488" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>Métodos de pago</p>
          {loading ? <div className={styles.chartSkeleton} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data?.metodos_pie ?? []} cx="50%" cy="48%"
                  innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                  {(data?.metodos_pie ?? []).map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={TT_STYLE} formatter={(v) => [`$${(v as number).toFixed(2)}`]} />
                <Legend iconSize={9} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className={styles.chartCard}>
        <p className={styles.chartTitle}>Utilidad bruta por período</p>
        {loading ? <div className={`${styles.chartSkeleton} ${styles.chartSkeletonBar}`} /> : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data?.utilidad_barras ?? []} margin={{ top: 5, right: 8, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => `$${v}`} />
              <Tooltip contentStyle={TT_STYLE} formatter={(v) => [`$${(v as number).toFixed(2)}`, 'Utilidad']} />
              <Bar dataKey="usd" fill="#1D9E75" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {data?.top_products && data.top_products.length > 0 && (
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>Top 5 productos del período</p>
          <div className={styles.topList}>
            {data.top_products.map((p, i) => (
              <div key={i} className={styles.topItem}>
                <span className={styles.topRank}>{i + 1}</span>
                <span className={styles.topName}>{p.name}</span>
                <span className={styles.topValue}>${p.total_usd.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
