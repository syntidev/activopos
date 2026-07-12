import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generateMonthlyPDF } from '@/lib/reports'

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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Período inválido (YYYY-MM)' }, { status: 400 })
  }

  const { period } = parsed.data

  try {
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

    // Generación eager: el cron de n8n espera solo 5 min antes de leer /pending,
    // tiempo insuficiente para que el dueño abra el dashboard y dispare la
    // generación lazy. Generamos el PDF acá mismo para cada reporte recién
    // dejado en 'pending', así queda 'ready' con token listo de inmediato.
    const toGenerate = await prisma.monthlyReport.findMany({
      where: { business_id: { in: businessIds }, period, status: 'pending' },
      select: { id: true, business_id: true },
    })

    let generated = 0
    let failed = 0
    for (const report of toGenerate) {
      try {
        const { filePath, token, expiresAt } = await generateMonthlyPDF(report.business_id, period)
        await prisma.monthlyReport.update({
          where: { id: report.id },
          data: {
            status:           'ready',
            file_path:        filePath,
            download_token:   token,
            token_expires_at: expiresAt,
            generated_at:     new Date(),
          },
        })
        generated++
      } catch (err) {
        console.error(`[mark-pending] fallo generando PDF business_id=${report.business_id} period=${period}:`, err)
        await prisma.monthlyReport.update({
          where: { id: report.id },
          data:  { status: 'failed' },
        })
        failed++
      }
    }

    return NextResponse.json({
      ok:        true,
      period,
      total:     businessIds.length,
      created:   created.count,
      reset:     updated.count,
      generated,
      failed,
    })
  } catch (error) {
    console.error('[mark-pending] fallo creando reportes pending:', error)
    return NextResponse.json({ error: 'No se pudo procesar el período' }, { status: 500 })
  }
}
