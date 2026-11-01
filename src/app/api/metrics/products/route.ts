export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getProductMetrics } from '@/lib/metrics'
import { metricsError, queryObject, requireMetricsAccess } from '@/lib/metrics-http'
import { productsQuerySchema } from '@/lib/metrics-schemas'

// Contrato: .doc/CONTRATO_METRICAS.md §3.1
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireMetricsAccess()
    const query = productsQuerySchema.parse(queryObject(req.nextUrl))
    return NextResponse.json(await getProductMetrics(session.businessId, query))
  } catch (e) {
    return metricsError(e, 'products')
  }
}
