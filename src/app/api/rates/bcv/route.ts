import { NextRequest, NextResponse } from 'next/server'
import { getBcvRate, readCachedBcvRate, getOtherRate, getActiveRate, getParallelRate } from '@/lib/bcv'
import { getSession, type SessionPayload } from '@/lib/auth'
import { ratesLimiter, getClientIp } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  try {
    await ratesLimiter.consume(getClientIp(req))
  } catch {
    return NextResponse.json({ error: 'Too many requests', ok: false }, { status: 429 })
  }

  let session: SessionPayload | null
  try {
    session = await getSession() // puede ser null — endpoint semi-público
  } catch (err) {
    console.error('rates/bcv getSession failed:', err)
    return NextResponse.json({ error: 'No autorizado', ok: false }, { status: 401 })
  }

  try {
    // Tasa activa (manual override o BCV) — es la que el sistema debe usar.
    const active = await getActiveRate(session?.businessId)

    // BCV real siempre, como referencia (aunque haya override manual activo).
    const [bcvResult, paraleloResult, usdtResult] = await Promise.allSettled([
      session?.businessId ? getBcvRate(session.businessId) : readCachedBcvRate(),
      getParallelRate(),
      getOtherRate('usdt'),
    ])

    const bcv      = bcvResult.status === 'fulfilled' ? bcvResult.value : null
    const paralelo = paraleloResult.status === 'fulfilled' ? paraleloResult.value : null
    const usdt     = usdtResult.status === 'fulfilled' ? usdtResult.value : null

    return NextResponse.json({
      ok:            true,
      rate:          active.rate,          // tasa activa (manual o bcv)
      source:        active.source,        // 'manual' | 'bcv'
      manual_active: active.source === 'manual',
      bcv_rate:      bcv,                  // BCV real de referencia
      bcv,                                 // backward compat (admin BcvRateSection lee .bcv)
      paralelo,
      parallel_rate: paralelo,             // sugerencia para el campo manual del frontend
      usdt,
    })
  } catch (err) {
    console.error('rates/bcv GET failed:', err)
    return NextResponse.json(
      { error: 'No se pudo obtener la tasa BCV', ok: false },
      { status: 500 },
    )
  }
}
