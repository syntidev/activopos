import { prisma } from './prisma'

const BCV_API      = process.env.BCV_API_URL ?? 'https://ve.dolarapi.com/v1/dolares/oficial'
const BRECHA_API   = 'https://brecha-cambiaria.com/api/prices' // fuente secundaria de BCV
const PARALLEL_API = 'https://ve.dolarapi.com/v1/dolares/paralelo'
const USDT_API     = 'https://ve.dolarapi.com/v1/dolares/cripto'
// Último recurso solo cuando la DB está vacía — mantener actualizado manualmente.
const FALLBACK_RATE = parseFloat(process.env.BCV_FALLBACK_RATE ?? '617.00')
const CACHE_TTL = 60 * 60 * 1000 // 1 hora en ms

// Sanidad de tasa (patrón SYNTImeat): rechaza valores absurdos y saltos > 60%
// respecto a la última conocida. Evita que un glitch de la API corrompa la DB.
const RATE_MIN = 10
const RATE_MAX = 10_000
const MAX_VARIATION = 0.60

function isPlausibleRate(rate: number, previous: number | null): boolean {
  if (!rate || isNaN(rate) || rate <= RATE_MIN || rate >= RATE_MAX) return false
  if (previous && previous > 0 && Math.abs(rate - previous) / previous > MAX_VARIATION) return false
  return true
}

// Fetch de tasa BCV con fallback dual: ve.dolarapi.com → brecha-cambiaria.com.
// Valida rango y variación en cada fuente. Lanza si ninguna da una tasa plausible.
async function fetchBcvRate(previous: number | null): Promise<number> {
  // FUENTE 1 — ve.dolarapi.com (campo "promedio")
  try {
    const res = await fetch(BCV_API, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const data = await res.json() as Record<string, unknown>
      const raw  = data.promedio ?? data.price ?? data.dolar
      const rate = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
      if (isPlausibleRate(rate, previous)) return rate
    }
  } catch (err) {
    console.error('BCV fuente 1 (dolarapi) falló:', err)
  }

  // FUENTE 2 — brecha-cambiaria.com (campo "bcv_usd")
  const res = await fetch(BRECHA_API, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`brecha API error: ${res.status}`)
  const data = await res.json() as Record<string, unknown>
  const raw  = data.bcv_usd ?? data.promedio ?? data.price
  const rate = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
  if (!isPlausibleRate(rate, previous)) throw new Error('brecha: tasa inválida')
  return rate
}

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

  // 2. Cache expirado — fetch de API con fallback dual (dolarapi → brecha).
  // cache: 'no-store' es obligatorio: Next.js data cache almacena respuestas fetch
  // independientemente del TTL de DB, causando que el "refresh" devuelva datos stale.
  const prevRow = await prisma.dollarRate.findFirst({
    where: { source: 'bcv' },
    orderBy: { fetched_at: 'desc' },
    select: { rate: true },
  })
  const previous = prevRow ? parseFloat(prevRow.rate.toString()) : null

  try {
    const rate = await fetchBcvRate(previous)

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
    if (previous !== null) return previous
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

// ── Tasa manual override (patrón SYNTImeat) ──────────────────────────────────
// DollarRate es global/compartida entre tenants (ver prisma-tenant.ts): la tasa
// manual se guarda con business_id = null igual que BCV. DB es la única fuente de
// verdad — sin cache en memoria.

// Desactiva la manual anterior y crea una nueva activa. Atómico bajo PM2 cluster.
export async function storeManualRate(rate: number): Promise<void> {
  await prisma.$transaction([
    prisma.dollarRate.updateMany({
      where: { source: 'manual', is_active: true },
      data:  { is_active: false },
    }),
    prisma.dollarRate.create({
      data: { rate, source: 'manual', is_active: true, business_id: null },
    }),
  ])
}

// Desactiva la manual y reactiva la última BCV conocida (para que getActiveRate
// vuelva a BCV sin depender de un fetch inmediato).
export async function releaseManualRate(): Promise<void> {
  const lastBcv = await prisma.dollarRate.findFirst({
    where: { source: 'bcv' },
    orderBy: { fetched_at: 'desc' },
    select: { id: true },
  })
  await prisma.$transaction([
    prisma.dollarRate.updateMany({
      where: { source: 'manual', is_active: true },
      data:  { is_active: false },
    }),
    ...(lastBcv
      ? [prisma.dollarRate.update({ where: { id: lastBcv.id }, data: { is_active: true } })]
      : []),
  ])
}

// Tasa efectiva del sistema: manual override activo tiene prioridad; si no,
// BCV (fetch con fallback dual + fallback a DB). Nunca lanza.
export async function getActiveRate(businessId?: number): Promise<{ rate: number; source: string }> {
  const manual = await prisma.dollarRate.findFirst({
    where: { source: 'manual', is_active: true },
    orderBy: { fetched_at: 'desc' },
    select: { rate: true },
  })
  if (manual) return { rate: parseFloat(manual.rate.toString()), source: 'manual' }

  const rate = await getBcvRate(businessId)
  return { rate, source: 'bcv' }
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
