export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { businessMonthKey } from '@/lib/business-day'
import { getGoalItem, getGoals, refExists } from '@/lib/metrics'
import { metricsError, queryObject, requireMetricsAccess } from '@/lib/metrics-http'
import { createGoalSchema, goalsQuerySchema } from '@/lib/metrics-schemas'

// Contrato: .doc/CONTRATO_METRICAS.md §3.4
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireMetricsAccess()
    const { period } = goalsQuerySchema.parse(queryObject(req.nextUrl))
    return NextResponse.json(await getGoals(session.businessId, period ?? businessMonthKey()))
  } catch (e) {
    return metricsError(e, 'goals')
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireMetricsAccess()
    let raw: unknown
    try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
    const body = createGoalSchema.parse(raw)
    if (!(await refExists(session.businessId, body.scope, body.ref_id))) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    }
    let id: number
    try {
      const created = await prisma.salesGoal.create({
        data: {
          business_id: session.businessId, // siempre de la sesión
          scope: body.scope, ref_id: body.ref_id, period: body.period, metric: body.metric,
          target: Math.round(body.target * 100) / 100,
          created_by: session.userId,
        },
        select: { id: true },
      })
      id = created.id
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return NextResponse.json({ error: 'Ya existe una meta para ese ítem, período y métrica' }, { status: 409 })
      }
      throw e
    }
    const goal = await getGoalItem(session.businessId, id)
    return NextResponse.json({ goal }, { status: 201 })
  } catch (e) {
    return metricsError(e, 'goals create')
  }
}
