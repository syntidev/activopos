import { prisma } from './prisma'

const BCV_API      = process.env.BCV_API_URL ?? 'https://ve.dolarapi.com/v1/dolares/oficial'
const PARALLEL_API = 'https://ve.dolarapi.com/v1/dolares/paralelo'
const USDT_API     = 'https://ve.dolarapi.com/v1/dolares/cripto'
// Último recurso solo cuando la DB está vacía — mantener actualizado manualmente.
const FALLBACK_RATE = parseFloat(process.env.BCV_FALLBACK_RATE ?? '617.00')
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

  // 2. Cache expirado — fetch de API.
  // cache: 'no-store' es obligatorio: Next.js data cache almacena respuestas fetch
  // independientemente del TTL de DB, causando que el "refresh" devuelva datos stale.
  try {
    const res = await fetch(BCV_API, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`BCV API error: ${res.status}`)

    const data = await res.json() as Record<string, unknown>
    const raw = data.promedio ?? data.price ?? data.dolar
    const rate = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
    if (!rate || isNaN(rate)) throw new Error('BCV: tasa inválida')

    // Transacción atómica: evita filas duplicadas con is_active=true bajo PM2 cluster
    await prisma.$transaction([
      prisma.dollarRate.updateMany({
        where: { is_active: true, source: 'bcv' },
        data: { is_active: false },
      }),
      prisma.dollarRate.create({
        data: { rate, source: 'bcv', is_active: true, business_id: businessId ?? null },
      }),
    ])

    return rate

  } catch (err) {
    console.error('BCV fetch failed:', err)

    // Fallback: última tasa conocida en DB (sin límite de edad)
    const last = await prisma.dollarRate.findFirst({
      where: { source: 'bcv' },
      orderBy: { fetched_at: 'desc' },
      select: { rate: true },
    })
    if (last) return parseFloat(last.rate.toString())
    return FALLBACK_RATE
  }
}

// Fetch + cache de tasa paralelo o usdt (1h TTL en DB, igual que BCV).
// Retorna null si no se puede obtener (nunca bloquea flujo de venta).
export async function getOtherRate(source: 'paralelo' | 'usdt'): Promise<number | null> {
  const apiUrl = source === 'paralelo' ? PARALLEL_API : USDT_API

  const cached = await prisma.dollarRate.findFirst({
    where: {
      source,
      is_active:  true,
      fetched_at: { gte: new Date(Date.now() - CACHE_TTL) },
    },
    orderBy: { fetched_at: 'desc' },
    select:  { rate: true },
  })
  if (cached) return parseFloat(cached.rate.toString())

  try {
    const res = await fetch(apiUrl, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error(`${source} API error: ${res.status}`)
    const data = await res.json() as Record<string, unknown>
    const raw = data.promedio ?? data.price ?? data.dolar
    const rate = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
    if (!rate || isNaN(rate)) throw new Error(`${source}: tasa inválida`)

    await prisma.$transaction([
      prisma.dollarRate.updateMany({ where: { is_active: true, source }, data: { is_active: false } }),
      prisma.dollarRate.create({ data: { rate, source, is_active: true, business_id: null } }),
    ])
    return rate
  } catch (err) {
    console.error(`${source} fetch failed:`, err)
    const last = await prisma.dollarRate.findFirst({
      where:   { source },
      orderBy: { fetched_at: 'desc' },
      select:  { rate: true },
    })
    return last ? parseFloat(last.rate.toString()) : null
  }
}

// Lee tasa desde DB sin hacer fetch externo ni escribir registros.
// Uso: endpoints que no tienen session.businessId disponible.
// Puede devolver una tasa de cualquier antigüedad — nunca bloquea la operación.
export async function readCachedBcvRate(): Promise<number> {
  const last = await prisma.dollarRate.findFirst({
    where: { source: 'bcv' },
    orderBy: { fetched_at: 'desc' },
    select: { rate: true },
  })
  if (last) return parseFloat(last.rate.toString())
  return FALLBACK_RATE
}

// Alias con nombre simétrico a getBcvRate() — misma fuente/caché que getOtherRate('paralelo').
export function getParallelRate(): Promise<number | null> {
  return getOtherRate('paralelo')
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
