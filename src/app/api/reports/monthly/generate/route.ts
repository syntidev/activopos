import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateMonthlyPDF } from '@/lib/reports'

const bodySchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
})

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Período inválido (YYYY-MM)' }, { status: 400 })
  }

  const { period } = parsed.data

  // Upsert: crear registro si no existe, marcar como generating
  const report = await prisma.monthlyReport.upsert({
    where: {
      business_id_period: { business_id: session.businessId, period },
    },
    create: {
      business_id: session.businessId,
      period,
      status: 'generating',
    },
    update: {
      // Solo regenerar si no está ya en proceso o listo
      status: 'generating',
    },
  })

  try {
    const { filePath, token, expiresAt } = await generateMonthlyPDF(
      session.businessId,
      period
    )

    const updated = await prisma.monthlyReport.update({
      where: { id: report.id },
      data: {
        status:           'ready',
        file_path:        filePath,
        download_token:   token,
        token_expires_at: expiresAt,
        generated_at:     new Date(),
      },
    })

    return NextResponse.json({
      ok:           true,
      report_id:    updated.id,
      download_url: `/api/r/${token}`,
      expires_at:   expiresAt,
    })
  } catch (err) {
    await prisma.monthlyReport.update({
      where: { id: report.id },
      data:  { status: 'failed' },
    })
    console.error('monthly/generate error:', err)
    return NextResponse.json({ error: 'Error generando reporte' }, { status: 500 })
  }
}
