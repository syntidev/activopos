import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const ivaSchema = z.object({
  iva_enabled: z.boolean().optional(),
  iva_pct:     z.number().min(0).max(30).optional(),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const business = await prisma.business.findUnique({
    where:  { id: session.businessId },
    select: { iva_enabled: true, iva_pct: true },
  })
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  return NextResponse.json({
    ok:  true,
    iva: { iva_enabled: business.iva_enabled, iva_pct: Number(business.iva_pct) },
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  try {
    const body = await req.json()
    const data = ivaSchema.parse(body)

    if (data.iva_enabled === undefined && data.iva_pct === undefined) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const updateData: { iva_enabled?: boolean; iva_pct?: number } = {}
    if (data.iva_enabled !== undefined) updateData.iva_enabled = data.iva_enabled
    if (data.iva_pct !== undefined)     updateData.iva_pct     = data.iva_pct

    const business = await prisma.business.update({
      where:  { id: session.businessId },
      data:   updateData,
      select: { iva_enabled: true, iva_pct: true },
    })

    if (data.iva_enabled !== undefined) {
      await prisma.activityLog.create({
        data: {
          business_id: session.businessId,
          user_id:     session.userId,
          action:      data.iva_enabled ? 'iva_enabled' : 'iva_disabled',
          model_type:  'Business',
          model_id:    session.businessId,
          new_values:  { iva_enabled: data.iva_enabled, iva_pct: Number(business.iva_pct) },
        },
      })
    }

    return NextResponse.json({
      ok:  true,
      iva: { iva_enabled: business.iva_enabled, iva_pct: Number(business.iva_pct) },
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('PATCH /api/config/iva:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
