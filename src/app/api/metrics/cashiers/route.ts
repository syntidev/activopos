export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCashiers } from '@/lib/metrics'
import { metricsError, requireMetricsAccess } from '@/lib/metrics-http'

// Contrato: .doc/CONTRATO_METRICAS.md §3.3
export async function GET(): Promise<NextResponse> {
  try {
    const session = await requireMetricsAccess()
    return NextResponse.json(await getCashiers(session.businessId))
  } catch (e) {
    return metricsError(e, 'cashiers')
  }
}
