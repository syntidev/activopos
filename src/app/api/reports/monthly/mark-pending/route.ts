import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
})

// Endpoint para n8n cron — crea/actualiza registros monthly_reports como pending
// Protegido por x-api-key, sin auth JWT
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.N8N_API_KEY) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Período inválido (YYYY-MM)' }, { status: 400 })
  }

  const { period } = parsed.data

  // Obtener todos los negocios activos con configuración de WhatsApp
  const businesses = await prisma.business.findMany({
    where: { active: true },
    select: { id: true },
  })

  const results = await Promise.allSettled(
    businesses.map(b =>
      prisma.monthlyReport.upsert({
        where: {
          business_id_period: { business_id: b.id, period },
        },
        create: {
          business_id: b.id,
          period,
          status: 'pending',
        },
        update: {
          // No sobreescribir si ya está ready o generating
          status: 'pending',
        },
      })
    )
  )

  const succeeded = results.filter(r => r.status === 'fulfilled').length
  const failed    = results.filter(r => r.status === 'rejected').length

  return NextResponse.json({
    ok:        true,
    period,
    total:     businesses.length,
    succeeded,
    failed,
  })
}
