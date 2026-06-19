import { prisma } from './prisma'

const BCV_API = process.env.BCV_API_URL ?? 'https://ve.dolarapi.com/v1/dolares/oficial'
const FALLBACK_RATE = parseFloat(process.env.BCV_FALLBACK_RATE ?? '36.50')
const CACHE_TTL = 60 * 60 * 1000 // 1 hora en ms

let cache: { rate: number; fetchedAt: number } | null = null

export async function getBcvRate(businessId?: number): Promise<number> {
  // Retornar cache si es fresco
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.rate
  }

  try {
    const res = await fetch(BCV_API, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) throw new Error(`BCV API error: ${res.status}`)

    const data = await res.json()
    const rate = parseFloat(data.promedio ?? data.price ?? data.dolar)

    if (!rate || isNaN(rate)) throw new Error('BCV: tasa inválida')

    // Guardar en DB con business_id si está disponible.
    // Cache es global (BCV emite una sola tasa para todos los tenants) — la
    // atribución por tenant es best-effort: se registra en el miss de cache (~1h).
    await prisma.dollarRate.create({
      data: { rate, source: 'bcv', is_active: true, business_id: businessId ?? null },
    })

    // Desactivar tasas anteriores SOLO del mismo tenant para no tocar filas de otros negocios
    await prisma.dollarRate.updateMany({
      where: { is_active: true, business_id: businessId ?? null, NOT: { fetched_at: { gte: new Date() } } },
      data: { is_active: false },
    })

    cache = { rate, fetchedAt: Date.now() }
    return rate

  } catch (err) {
    console.error('BCV fetch failed:', err)

    // Intentar última tasa en DB
    const last = await prisma.dollarRate.findFirst({
      orderBy: { created_at: 'desc' },
    })

    if (last) {
      const rate = parseFloat(last.rate.toString())
      cache = { rate, fetchedAt: Date.now() }
      return rate
    }

    // Fallback duro
    return FALLBACK_RATE
  }
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