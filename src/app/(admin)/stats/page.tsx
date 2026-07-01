import { prisma } from '@/lib/prisma'
import { RegistrationsChart } from './RegistrationsChart'
import styles from '../admin.module.css'

const REGISTRATIONS_WINDOW_DAYS = 30

async function getStats() {
  try {
    const now         = new Date()
    const month       = new Date(now.getFullYear(), now.getMonth(), 1)
    const windowStart = new Date(now.getTime() - REGISTRATIONS_WINDOW_DAYS * 86_400_000)

    const [total, activeCount, trialCount, activeBusinessIds, salesAll, salesMonth, recentBusinesses] = await Promise.all([
      prisma.business.count(),
      prisma.business.count({ where: { active: true } }),
      prisma.business.count({ where: { catalog_plan: null } }),
      prisma.sale.findMany({
        where:    { status: 'paid', sold_at: { gte: windowStart } },
        select:   { business_id: true },
        distinct: ['business_id'],
      }),
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
      prisma.business.findMany({
        where:  { created_at: { gte: windowStart } },
        select: { created_at: true },
      }),
    ])

    const dailyMap = new Map<string, number>()
    for (const b of recentBusinesses) {
      const key = b.created_at.toISOString().slice(0, 10)
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1)
    }
    const registrationsByDay = Array.from({ length: REGISTRATIONS_WINDOW_DAYS }, (_, i) => {
      const d   = new Date(windowStart.getTime() + i * 86_400_000)
      const key = d.toISOString().slice(0, 10)
      return { date: key, count: dailyMap.get(key) ?? 0 }
    })

    return {
      total,
      active:           activeCount,
      trial:            trialCount,
      active30d:        activeBusinessIds.length,
      totalSalesUsd:    Number(salesAll._sum.total_usd  ?? 0),
      totalSalesCount:  salesAll._count,
      monthSalesUsd:    Number(salesMonth._sum.total_usd ?? 0),
      monthSalesCount:  salesMonth._count,
      registrationsByDay,
    }
  } catch {
    return {
      total: 0, active: 0, trial: 0, active30d: 0,
      totalSalesUsd: 0, totalSalesCount: 0, monthSalesUsd: 0, monthSalesCount: 0,
      registrationsByDay: [] as { date: string; count: number }[],
    }
  }
}

function fmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default async function StatsPage() {
  const s = await getStats()

  const kpis = [
    { label: 'Negocios totales',      value: String(s.total) },
    { label: 'Activos (30 días)',     value: String(s.active30d), accent: true },
    { label: 'En trial',              value: String(s.trial) },
    { label: 'Ventas este mes',       value: fmt(s.monthSalesUsd), sub: `${s.monthSalesCount} transacciones` },
    { label: 'Ventas históricas',     value: fmt(s.totalSalesUsd), sub: `${s.totalSalesCount} total` },
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

      <div className={styles.detailSection}>
        <h2 className={styles.sectionTitle}>Nuevos registros por día (últimos 30 días)</h2>
        <RegistrationsChart data={s.registrationsByDay} />
      </div>
    </div>
  )
}
