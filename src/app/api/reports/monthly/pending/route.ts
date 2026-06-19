import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Endpoint para n8n — lista reportes pendientes de generación y notificación WhatsApp
// Protegido por x-api-key, sin auth JWT
export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.N8N_API_KEY) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const pending = await prisma.monthlyReport.findMany({
    where: { status: 'pending' },
    include: {
      business: {
        select: {
          id:        true,
          name:      true,
          whatsapp:  true,
          catalog_slug: true,
        },
      },
    },
    orderBy: { created_at: 'asc' },
  })

  return NextResponse.json({
    ok:    true,
    count: pending.length,
    reports: pending.map(r => ({
      id:          r.id,
      period:      r.period,
      business_id: r.business_id,
      business:    r.business,
      created_at:  r.created_at,
    })),
  })
}
