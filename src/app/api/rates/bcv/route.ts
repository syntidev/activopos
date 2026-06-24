import { NextRequest, NextResponse } from 'next/server'
import { getBcvRate, readCachedBcvRate, getOtherRate } from '@/lib/bcv'
import { getSession } from '@/lib/auth'
import { ratesLimiter, getClientIp } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  try {
    await ratesLimiter.consume(getClientIp(req))
  } catch {
    return NextResponse.json({ error: 'Too many requests', ok: false }, { status: 429 })
  }

  const session = await getSession() // puede ser null — endpoint semi-público

  try {
    const [bcvResult, paraleloResult, usdtResult] = await Promise.allSettled([
      session?.businessId
        ? getBcvRate(session.businessId)
        : readCachedBcvRate(),
      getOtherRate('paralelo'),
      getOtherRate('usdt'),
    ])

    // BCV es obligatorio — si falla, devolver error
    if (bcvResult.status === 'rejected') {
      return NextResponse.json(
        { error: 'No se pudo obtener la tasa BCV', ok: false },
        { status: 500 },
      )
    }

    const bcv      = bcvResult.value
    const paralelo = paraleloResult.status === 'fulfilled' ? paraleloResult.value : null
    const usdt     = usdtResult.status === 'fulfilled' ? usdtResult.value : null

    return NextResponse.json({
      ok:       true,
      bcv,
      paralelo,
      usdt,
      rate:     bcv,    // backward compat
      source:   'bcv',
    })
  } catch (err) {
    console.error('rates/bcv GET failed:', err)
    return NextResponse.json(
      { error: 'No se pudo obtener la tasa BCV', ok: false },
      { status: 500 },
    )
  }
}
