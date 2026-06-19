import { NextResponse } from 'next/server'
import { getBcvRate, readCachedBcvRate } from '@/lib/bcv'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession() // puede ser null — endpoint semi-público

  try {
    // Con sesión: escribe en dollar_rates con business_id (comportamiento completo)
    // Sin sesión: lee del cache o DB sin escribir nuevos registros con business_id null
    const rate = session?.businessId
      ? await getBcvRate(session.businessId)
      : await readCachedBcvRate()

    return NextResponse.json({ rate, source: 'bcv', ok: true })
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener la tasa BCV', ok: false },
      { status: 500 }
    )
  }
}
