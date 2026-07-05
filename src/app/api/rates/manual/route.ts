import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { storeManualRate, releaseManualRate, getActiveRate, readCachedBcvRate } from '@/lib/bcv'

// Rango de sanidad (mismo criterio que fetchBcvRate en lib/bcv).
const RATE_MIN = 10
const RATE_MAX = 10_000

const bodySchema = z.object({
  rate:   z.number().positive().optional(),
  active: z.boolean(),
}).refine(d => !d.active || (d.rate !== undefined), {
  message: 'rate es requerido cuando active=true',
  path: ['rate'],
})

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  let data: z.infer<typeof bodySchema>
  try {
    data = bodySchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    throw err
  }

  if (data.active && data.rate !== undefined) {
    if (data.rate <= RATE_MIN || data.rate >= RATE_MAX) {
      return NextResponse.json({ error: `Tasa fuera de rango (${RATE_MIN} - ${RATE_MAX})` }, { status: 400 })
    }
    await storeManualRate(data.rate, session.businessId)
  } else {
    await releaseManualRate(session.businessId)
  }

  const active   = await getActiveRate(session.businessId)
  const bcvRate  = await readCachedBcvRate() // BCV real de referencia, sin fetch externo
  return NextResponse.json({
    rate:          active.rate,
    source:        active.source,
    manual_active: active.source === 'manual',
    bcv_rate:      bcvRate,
  })
}
