export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getGoalItem } from '@/lib/metrics'
import { metricsError, requireMetricsAccess } from '@/lib/metrics-http'
import { patchGoalSchema } from '@/lib/metrics-schemas'

// Contrato: .doc/CONTRATO_METRICAS.md §3.4. Una meta de otro negocio es "no encontrada" (404), nunca 403.
function goalId(raw: string): number | null {
  return /^\d{1,9}$/.test(raw) ? Number(raw) : null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const session = await requireMetricsAccess()
    const id = goalId(params.id)
    let raw: unknown
    try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
    const body = patchGoalSchema.parse(raw)
    if (id === null) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    const res = await prisma.salesGoal.updateMany({
      where: { id, business_id: session.businessId },
      data: { target: Math.round(body.target * 100) / 100 },
    })
    if (res.count === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ goal: await getGoalItem(session.businessId, id) })
  } catch (e) {
    return metricsError(e, 'goals update')
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const session = await requireMetricsAccess()
    const id = goalId(params.id)
    if (id === null) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    const res = await prisma.salesGoal.deleteMany({ where: { id, business_id: session.businessId } })
    if (res.count === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return metricsError(e, 'goals delete')
  }
}
