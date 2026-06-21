import { prisma } from './prisma'

const BCV_API = process.env.BCV_API_URL ?? 'https://ve.dolarapi.com/v1/dolares/oficial'
const FALLBACK_RATE = parseFloat(process.env.BCV_FALLBACK_RATE ?? '36.50')
const CACHE_TTL = 60 * 60 * 1000 // 1 hora en ms

// Cache en DB (cluster-safe para PM2 multi-worker).
// El campo fetched_at ya existe en dollar_rates y sirve como cached_at.
export async function getBcvRate(businessId?: number): Promise<number> {
  // 1. Buscar tasa fresca en DB (< 1h de antigüedad)
  const cached = await prisma.dollarRate.findFirst({
    where: {
      source: 'bcv',
      is_active: true,
      fetched_at: { gte: new Date(Date.now() - CACHE_TTL) },
    },
    orderBy: { fetched_at: 'desc' },
    select: { rate: true },
  })
  if (cached) return parseFloat(cached.rate.toString())

  // 2. Cache expirado — fetch de API
  try {
    const res = await fetch(BCV_API, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`BCV API error: ${res.status}`)

    const data = await res.json()
    const rate = parseFloat(data.promedio ?? data.price ?? data.dolar)
    if (!rate || isNaN(rate)) throw new Error('BCV: tasa inválida')

    // Desactivar anteriores, insertar nueva — todos los workers leerán la misma fila
    await prisma.dollarRate.updateMany({
      where: { is_active: true, source: 'bcv' },
      data: { is_active: false },
    })
    await prisma.dollarRate.create({
      data: { rate, source: 'bcv', is_active: true, business_id: businessId ?? null },
    })

    return rate

  } catch (err) {
    console.error('BCV fetch failed:', err)

    // Fallback: última tasa conocida en DB
    const last = await prisma.dollarRate.findFirst({
      where: { source: 'bcv' },
      orderBy: { fetched_at: 'desc' },
      select: { rate: true },
    })
    if (last) return parseFloat(last.rate.toString())
    return FALLBACK_RATE
  }
}

// Lee tasa desde DB sin hacer fetch externo ni escribir registros.
// Uso: endpoints que no tienen session.businessId disponible.
export async function readCachedBcvRate(): Promise<number> {
  const last = await prisma.dollarRate.findFirst({
    where: { source: 'bcv' },
    orderBy: { fetched_at: 'desc' },
    select: { rate: true },
  })
  if (last) return parseFloat(last.rate.toString())
  return FALLBACK_RATE
}

export function formatBs(usd: number, rate: number): string {
  return (usd * rate).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatUsd(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
