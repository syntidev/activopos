import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
})

// Endpoint para n8n cron — crea registros monthly_reports como pending
// Protegido por x-api-key, sin auth JWT
// Invariante: status='ready' y status='generating' NO se tocan
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

  const businesses = await prisma.business.findMany({
    where:  { active: true },
    select: { id: true },
  })

  const businessIds = businesses.map(b => b.id)

  // Dos pasos en transacción:
  // 1. createMany(skipDuplicates) → crea registros solo para negocios sin reporte del período
  // 2. updateMany(status='failed') → reinicia solo los fallidos; ready/generating quedan intactos
  const [created, updated] = await prisma.$transaction([
    prisma.monthlyReport.createMany({
      data: businessIds.map(id => ({
        business_id: id,
        period,
        status: 'pending' as const,
      })),
      skipDuplicates: true,
    }),
    prisma.monthlyReport.updateMany({
      where: {
        business_id: { in: businessIds },
        period,
        status: 'failed',
      },
      data: { status: 'pending' },
    }),
  ])

  return NextResponse.json({
    ok:       true,
    period,
    total:    businessIds.length,
    created:  created.count,
    reset:    updated.count,
  })
}
