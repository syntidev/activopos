import { NextResponse } from 'next/server'
import { getBcvRate } from '@/lib/bcv'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const rate = await getBcvRate(session.businessId)
    return NextResponse.json({ rate, source: 'bcv', ok: true })
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener la tasa BCV', ok: false },
      { status: 500 }
    )
  }
}
