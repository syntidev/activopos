export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getGroupMetrics } from '@/lib/metrics'
import { metricsError, queryObject, requireMetricsAccess } from '@/lib/metrics-http'
import { groupsQuerySchema } from '@/lib/metrics-schemas'

// Contrato: .doc/CONTRATO_METRICAS.md §3.2
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireMetricsAccess()
    const { by, ...filters } = groupsQuerySchema.parse(queryObject(req.nextUrl))
    return NextResponse.json(await getGroupMetrics(session.businessId, by, filters))
  } catch (e) {
    return metricsError(e, 'groups')
  }
}
