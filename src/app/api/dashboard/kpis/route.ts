import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getKpiData, getGreeting } from '@/lib/dashboard'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const [kpiData] = await Promise.all([getKpiData(session.businessId)])

  return NextResponse.json({
    ok:       true,
    greeting: getGreeting(new Date().getHours()),
    kpis:     kpiData,
  })
}
