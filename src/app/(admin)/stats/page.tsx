import { prisma } from '@/lib/prisma'
import styles from '../admin.module.css'

async function getStats() {
  try {
    const now   = new Date()
    const month = new Date(now.getFullYear(), now.getMonth(), 1)

    const [total, activeCount, salesAll, salesMonth] = await Promise.all([
      prisma.business.count(),
      prisma.business.count({ where: { active: true } }),
      prisma.sale.aggregate({
        where:  { status: 'paid' },
        _sum:   { total_usd: true },
        _count: true,
      }),
      prisma.sale.aggregate({
        where:  { status: 'paid', sold_at: { gte: month } },
        _sum:   { total_usd: true },
        _count: true,
      }),
    ])

    return {
      total,
      active:          activeCount,
      totalSalesUsd:   Number(salesAll._sum.total_usd  ?? 0),
      totalSalesCount: salesAll._count,
      monthSalesUsd:   Number(salesMonth._sum.total_usd ?? 0),
      monthSalesCount: salesMonth._count,
    }
  } catch {
    return { total: 0, active: 0, totalSalesUsd: 0, totalSalesCount: 0, monthSalesUsd: 0, monthSalesCount: 0 }
  }
}

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default async function StatsPage() {
  const s = await getStats()

  const kpis = [
    { label: 'Negocios totales',  value: String(s.total) },
    { label: 'Negocios activos',  value: String(s.active), accent: true },
    { label: 'Ventas este mes',   value: fmt(s.monthSalesUsd),  sub: `${s.monthSalesCount} transacciones` },
    { label: 'Ventas históricas', value: fmt(s.totalSalesUsd),  sub: `${s.totalSalesCount} total` },
  ]

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Estadísticas</h1>
        <p className={styles.pageSubtitle}>Vista global del sistema</p>
      </div>

      <div className={styles.kpiGrid}>
        {kpis.map(k => (
          <div key={k.label} className={styles.kpiCard}>
            <p className={styles.kpiLabel}>{k.label}</p>
            <p className={`${styles.kpiValue} ${k.accent ? styles.kpiAccent : ''}`}>{k.value}</p>
            {k.sub && <p className={styles.kpiSub}>{k.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
