import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedTenant, TenantError } from '@/lib/tenant'
import type { SessionPayload } from '@/lib/auth'
import type { TenantPrisma } from '@/lib/prisma-tenant'
import { generateMonthlyPDF } from '@/lib/reports'

const bodySchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
})

export async function POST(req: NextRequest) {
  let session: SessionPayload
  let db: TenantPrisma
  try {
    const t = await getAuthenticatedTenant()
    session = t.session
    db = t.db
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Período inválido (YYYY-MM)' }, { status: 400 })
  }

  const { period } = parsed.data

  // Upsert: crear registro si no existe, marcar como generating (business_id inyectado por la capa)
  const report = await db.monthlyReport.upsert({
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

    const updated = await db.monthlyReport.update({
      where: { id: report.id }, // business_id inyectado por el tenant layer
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
    await db.monthlyReport.update({
      where: { id: report.id }, // business_id inyectado por el tenant layer
      data:  { status: 'failed' },
    })
    console.error('monthly/generate error:', err)
    return NextResponse.json({ error: 'Error generando reporte' }, { status: 500 })
  }
}
