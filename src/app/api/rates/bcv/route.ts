import { NextResponse } from 'next/server'
import { getBcvRate, readCachedBcvRate, getOtherRate } from '@/lib/bcv'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession() // puede ser null — endpoint semi-público

  try {
    const [bcv, paralelo, usdt] = await Promise.all([
      session?.businessId
        ? getBcvRate(session.businessId)
        : readCachedBcvRate(),
      getOtherRate('paralelo'),
      getOtherRate('usdt'),
    ])

    return NextResponse.json({
      ok:       true,
      bcv,
      paralelo,
      usdt,
      rate:     bcv,    // backward compat
      source:   'bcv',
    })
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener la tasa BCV', ok: false },
      { status: 500 }
    )
  }
}
