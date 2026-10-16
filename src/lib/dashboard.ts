import { prisma } from './prisma'
import { netCogs, netSales } from './sales-returns'
import { businessDateKey, businessDayStart, businessMonthKey, businessMonthRange, shiftDateKey } from './business-day'

export interface KpiData {
  ventas_hoy:   { value_usd: number; trend_pct: number }
  utilidad_hoy: { value_usd: number; trend_pct: number }
  ventas_mes:   { value_usd: number; trend_pct: number }
  utilidad_mes: { value_usd: number; trend_pct: number }
  bcvRate:      number
}

export function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Buen día'
  if (hour >= 12 && hour < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

export function calcTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
}

export function fmtBs(usd: number, rate: number): string {
  if (!rate) return ''
  return (
    'Bs. ' +
    (usd * rate).toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

export async function getKpiData(businessId: number): Promise<KpiData> {
  // Hora del negocio (America/Caracas), ver business-day.ts.
  const todayKey       = businessDateKey()
  const todayStart     = businessDayStart(todayKey)
  const tomorrowStart  = businessDayStart(shiftDateKey(todayKey, 1))
  const yesterdayStart = businessDayStart(shiftDateKey(todayKey, -1))
  const monthStart     = businessMonthRange(businessMonthKey()).start
  const prevMonthStart = businessMonthRange(businessMonthKey(new Date(), 1)).start

  type RateRow   = { rate: string | number }

  const [
    todayAgg, yesterdayAgg, monthAgg, prevMonthAgg,
    todayP, yesterdayP, monthP, prevMonthP,
    rateRows,
  ] = await Promise.all([
    // Ingreso y COGS netos -- fuente única (src/lib/sales-returns.ts).
    netSales(businessId, todayStart, tomorrowStart),
    netSales(businessId, yesterdayStart, todayStart),
    netSales(businessId, monthStart),
    netSales(businessId, prevMonthStart, monthStart),
    netCogs(businessId, todayStart, tomorrowStart),
    netCogs(businessId, yesterdayStart, todayStart),
    netCogs(businessId, monthStart),
    netCogs(businessId, prevMonthStart, monthStart),
    prisma.$queryRaw<RateRow[]>`SELECT rate FROM dollar_rates ORDER BY created_at DESC LIMIT 1`,
  ])

  const bcvRate = parseFloat(String(rateRows[0]?.rate ?? '36.50')) || 36.50

  const r2 = (x: number) => Math.round(x * 100) / 100
  const vHoy    = todayAgg.net.usd
  const vAyer   = yesterdayAgg.net.usd
  const vMes    = monthAgg.net.usd
  const vMesAnt = prevMonthAgg.net.usd
  // Utilidad = ingreso neto − COGS neto.
  const uHoy    = r2(vHoy    - todayP.netUsd)
  const uAyer   = r2(vAyer   - yesterdayP.netUsd)
  const uMes    = r2(vMes    - monthP.netUsd)
  const uMesAnt = r2(vMesAnt - prevMonthP.netUsd)

  return {
    ventas_hoy:   { value_usd: vHoy,  trend_pct: calcTrend(vHoy,  vAyer)   },
    utilidad_hoy: { value_usd: uHoy,  trend_pct: calcTrend(uHoy,  uAyer)   },
    ventas_mes:   { value_usd: vMes,  trend_pct: calcTrend(vMes,  vMesAnt) },
    utilidad_mes: { value_usd: uMes,  trend_pct: calcTrend(uMes,  uMesAnt) },
    bcvRate,
  }
}
