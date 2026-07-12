import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({
  report_id:    z.number().int().positive(),
  wa_url:       z.string().url(),
  notified_at:  z.string().datetime().optional(),
})

// Endpoint para n8n — marca un MonthlyReport como notificado y guarda el
// link de WhatsApp que el banner de la app muestra al dueño del negocio.
// Protegido por x-api-key, sin auth JWT — mismo patrón que mark-pending/pending.
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.N8N_API_KEY) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 })
  }

  const { report_id, wa_url, notified_at } = parsed.data

  const existing = await prisma.monthlyReport.findUnique({ where: { id: report_id } })
  if (!existing) {
    return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
  }

  const updated = await prisma.monthlyReport.update({
    where: { id: report_id },
    data: {
      wa_url,
      // notified_at: el server es fuente de verdad del timestamp — el valor
      // que manda n8n solo se usa si viene, nunca se confía ciegamente en
      // el reloj de un tercero para el registro oficial.
      notified_at: notified_at ? new Date(notified_at) : new Date(),
    },
  })

  return NextResponse.json({
    ok:          true,
    report_id:   updated.id,
    notified_at: updated.notified_at,
  })
}
