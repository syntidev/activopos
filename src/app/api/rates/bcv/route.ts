import { NextResponse } from 'next/server'
import { getBcvRate } from '@/lib/bcv'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    const rate = await getBcvRate(session?.businessId)
    return NextResponse.json({ rate, source: 'bcv', ok: true })
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener la tasa BCV', ok: false },
      { status: 500 }
    )
  }
}
