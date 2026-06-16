import { NextResponse } from 'next/server'
import { getBcvRate } from '@/lib/bcv'

export async function GET() {
  try {
    const rate = await getBcvRate()
    return NextResponse.json({ rate, source: 'bcv', ok: true })
  } catch {
    return NextResponse.json(
      { error: 'No se pudo obtener la tasa BCV', ok: false },
      { status: 500 }
    )
  }
}